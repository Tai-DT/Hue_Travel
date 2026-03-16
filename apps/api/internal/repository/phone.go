package repository

import "strings"

var phoneCleanup = strings.NewReplacer(
	" ", "",
	"-", "",
	".", "",
	"(", "",
	")", "",
)

func phoneLookupCandidates(raw string) []string {
	cleaned := phoneCleanup.Replace(strings.TrimSpace(raw))
	if cleaned == "" {
		return nil
	}

	seen := make(map[string]struct{}, 6)
	candidates := make([]string, 0, 6)
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, exists := seen[value]; exists {
			return
		}
		seen[value] = struct{}{}
		candidates = append(candidates, value)
	}

	add(cleaned)

	switch {
	case strings.HasPrefix(cleaned, "+84"):
		rest := cleaned[3:]
		add("84" + rest)
		add("0" + rest)
		add(rest)
	case strings.HasPrefix(cleaned, "84"):
		rest := cleaned[2:]
		add("+84" + rest)
		add("0" + rest)
		add(rest)
	case strings.HasPrefix(cleaned, "0"):
		rest := cleaned[1:]
		add("84" + rest)
		add("+84" + rest)
		add(rest)
	default:
		add("0" + cleaned)
		add("84" + cleaned)
		add("+84" + cleaned)
	}

	return candidates
}
