package repository

import (
	"reflect"
	"testing"
)

func TestPhoneLookupCandidates(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "local format",
			input:    "0907778888",
			expected: []string{"0907778888", "84907778888", "+84907778888", "907778888"},
		},
		{
			name:     "international with plus",
			input:    "+84905556666",
			expected: []string{"+84905556666", "84905556666", "0905556666", "905556666"},
		},
		{
			name:     "seed without leading zero",
			input:    "901111222",
			expected: []string{"901111222", "0901111222", "84901111222", "+84901111222"},
		},
		{
			name:     "strips spaces and punctuation",
			input:    "(090) 777-8888",
			expected: []string{"0907778888", "84907778888", "+84907778888", "907778888"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := phoneLookupCandidates(tt.input)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Fatalf("phoneLookupCandidates(%q) = %#v, want %#v", tt.input, got, tt.expected)
			}
		})
	}
}
