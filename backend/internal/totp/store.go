package totp

import (
	"fmt"
	"sort"
	"sync"
	"time"
)

type Store struct {
	mu       sync.RWMutex
	accounts map[string]Account
	nextID   int64
}

func NewStore() *Store {
	return &Store{
		accounts: make(map[string]Account),
		nextID:   1,
	}
}

func (s *Store) List() []Account {
	s.mu.RLock()
	defer s.mu.RUnlock()

	accounts := make([]Account, 0, len(s.accounts))
	for _, account := range s.accounts {
		accounts = append(accounts, account.Public())
	}
	sort.Slice(accounts, func(i, j int) bool {
		return accounts[i].UpdatedAt.After(accounts[j].UpdatedAt)
	})
	return accounts
}

func (s *Store) Create(req CreateAccountRequest) (Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := fmt.Sprintf("totp_%d", s.nextID)
	s.nextID++
	now := time.Now().UTC()
	account, err := NewAccount(id, req, now)
	if err != nil {
		return Account{}, err
	}
	s.accounts[id] = account
	return account.Public(), nil
}

func (s *Store) Update(id string, req UpdateAccountRequest) (Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	account, ok := s.accounts[id]
	if !ok {
		return Account{}, ErrNotFound
	}
	updated, err := ApplyUpdate(account, req, time.Now().UTC())
	if err != nil {
		return Account{}, err
	}
	s.accounts[id] = updated
	return updated.Public(), nil
}

func (s *Store) Delete(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.accounts[id]; !ok {
		return false
	}
	delete(s.accounts, id)
	return true
}

func (s *Store) Code(id string) (CodeResponse, error) {
	s.mu.RLock()
	account, ok := s.accounts[id]
	s.mu.RUnlock()
	if !ok {
		return CodeResponse{}, ErrNotFound
	}
	return Generate(account, time.Now().UTC())
}

var ErrNotFound = fmt.Errorf("totp account not found")
