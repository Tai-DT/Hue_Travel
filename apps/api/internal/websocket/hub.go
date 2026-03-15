package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// ============================================
// WebSocket Hub — Real-time Chat
// ============================================

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// In production, validate origin against allowed list
		// For now, allow all origins (CORS middleware handles HTTP)
		return true
	},
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type     string          `json:"type"`     // message, typing, read, online
	RoomID   string          `json:"room_id"`
	SenderID string          `json:"sender_id"`
	Content  string          `json:"content,omitempty"`
	Data     json.RawMessage `json:"data,omitempty"`
}

// Client wraps a WebSocket connection per user
type Client struct {
	UserID uuid.UUID
	Conn   *websocket.Conn
	Hub    *Hub
	Send   chan []byte
}

// Hub manages all WebSocket clients
type Hub struct {
	clients    map[uuid.UUID]*Client
	rooms      map[string]map[uuid.UUID]bool // roomID -> set of userIDs
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
	done       chan struct{}
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[uuid.UUID]*Client),
		rooms:      make(map[string]map[uuid.UUID]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte, 256),
		done:       make(chan struct{}),
	}
}

// Stop gracefully shuts down the hub: close all client connections then stop the Run loop.
func (h *Hub) Stop() {
	h.mu.Lock()
	for _, client := range h.clients {
		close(client.Send)
		client.Conn.Close()
	}
	h.clients = make(map[uuid.UUID]*Client)
	h.mu.Unlock()
	close(h.done)
	log.Println("🛑 WebSocket hub stopped")
}

func (h *Hub) Run() {
	for {
		select {
		case <-h.done:
			return
		case client := <-h.register:
			h.mu.Lock()
			// Close existing connection for the same user (prevent duplicate sessions)
			if existing, ok := h.clients[client.UserID]; ok {
				close(existing.Send)
				existing.Conn.Close()
			}
			h.clients[client.UserID] = client
			h.mu.Unlock()

			log.Printf("🟢 User %s connected (total: %d)", client.UserID.String()[:8], len(h.clients))

			// Broadcast online status
			h.broadcastStatus(client.UserID, true)

		case client := <-h.unregister:
			h.mu.Lock()
			if existing, ok := h.clients[client.UserID]; ok {
				// Only remove if it's the same connection (prevent removing a newer session)
				if existing == client {
					delete(h.clients, client.UserID)
					close(client.Send)
				}
			}
			h.mu.Unlock()

			log.Printf("🔴 User %s disconnected (total: %d)", client.UserID.String()[:8], len(h.clients))

			h.broadcastStatus(client.UserID, false)

		case message := <-h.broadcast:
			var wsMsg WSMessage
			if err := json.Unmarshal(message, &wsMsg); err != nil {
				continue
			}

			// Send to all users in the room
			h.mu.RLock()
			if roomUsers, ok := h.rooms[wsMsg.RoomID]; ok {
				for userID := range roomUsers {
					if client, ok := h.clients[userID]; ok {
						select {
						case client.Send <- message:
						default:
							// Buffer full — skip this message (don't close the connection)
							log.Printf("⚠️ Send buffer full for user %s, skipping message", userID.String()[:8])
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// JoinRoom adds a user to a room
func (h *Hub) JoinRoom(roomID string, userID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[roomID] == nil {
		h.rooms[roomID] = make(map[uuid.UUID]bool)
	}
	h.rooms[roomID][userID] = true
}

// LeaveRoom removes a user from a room
func (h *Hub) LeaveRoom(roomID string, userID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if users, ok := h.rooms[roomID]; ok {
		delete(users, userID)
		if len(users) == 0 {
			delete(h.rooms, roomID)
		}
	}
}

// SendToUser sends a message to a specific user
func (h *Hub) SendToUser(userID uuid.UUID, msg WSMessage) {
	h.mu.RLock()
	client, ok := h.clients[userID]
	h.mu.RUnlock()

	if ok {
		data, _ := json.Marshal(msg)
		select {
		case client.Send <- data:
		default:
		}
	}
}

// IsOnline checks if a user is online
func (h *Hub) IsOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

// GetOnlineUsers returns list of online user IDs
func (h *Hub) GetOnlineUsers() []uuid.UUID {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users := make([]uuid.UUID, 0, len(h.clients))
	for id := range h.clients {
		users = append(users, id)
	}
	return users
}

// BroadcastToRoom sends raw data to all online users in a specific room.
// This is called by REST handlers (e.g. ChatHandler.SendMessage) to push
// real-time updates without requiring a WS client to initiate the broadcast.
func (h *Hub) BroadcastToRoom(roomID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	roomUsers, ok := h.rooms[roomID]
	if !ok {
		return
	}
	for userID := range roomUsers {
		if client, exists := h.clients[userID]; exists {
			select {
			case client.Send <- data:
			default:
				// Buffer full — skip this message
			}
		}
	}
}

func (h *Hub) broadcastStatus(userID uuid.UUID, online bool) {
	status := "offline"
	if online {
		status = "online"
	}

	msg := WSMessage{
		Type:     "status",
		SenderID: userID.String(),
		Content:  status,
	}

	data, _ := json.Marshal(msg)

	h.mu.RLock()
	for _, client := range h.clients {
		select {
		case client.Send <- data:
		default:
		}
	}
	h.mu.RUnlock()
}

// ============================================
// Client Read/Write Pumps
// ============================================

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(4096)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		// Inject sender ID from authenticated user (prevents spoofing)
		var wsMsg WSMessage
		if json.Unmarshal(message, &wsMsg) == nil {
			wsMsg.SenderID = c.UserID.String()

			switch wsMsg.Type {
			case "join":
				c.Hub.JoinRoom(wsMsg.RoomID, c.UserID)
			case "leave":
				c.Hub.LeaveRoom(wsMsg.RoomID, c.UserID)
			case "message", "typing", "read":
				data, _ := json.Marshal(wsMsg)
				c.Hub.broadcast <- data
			}
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.Conn.WriteMessage(websocket.TextMessage, message)

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ============================================
// Gin Handler — Now uses JWT auth from middleware
// ============================================

// HandleWebSocket creates a WebSocket handler.
// The user_id is extracted from the gin context (set by WebSocketAuth middleware).
func HandleWebSocket(hub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		// user_id is set by the WebSocketAuth middleware
		userIDVal, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		userID := userIDVal.(uuid.UUID)

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		client := &Client{
			UserID: userID,
			Conn:   conn,
			Hub:    hub,
			Send:   make(chan []byte, 256),
		}

		hub.register <- client

		go client.WritePump()
		go client.ReadPump()
	}
}
