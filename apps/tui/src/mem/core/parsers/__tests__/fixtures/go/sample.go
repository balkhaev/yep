// Package sample for testing Go parser
package sample

import (
	"context"
	"fmt"
)

// Constants
const (
	MaxRetries = 3
	APIUrl     = "https://api.example.com"
)

// Variables
var (
	counter int
	buffer  []byte
)

// SimpleFunction is a basic function with parameters
func SimpleFunction(name string) string {
	return fmt.Sprintf("Hello, %s", name)
}

// ComplexFunction with multiple parameters and return values
func ComplexFunction(ctx context.Context, id int, options ...string) (string, error) {
	return "result", nil
}

// User is a struct
type User struct {
	ID   int
	Name string
	Age  int
}

// NewUser is a constructor function
func NewUser(name string, age int) *User {
	return &User{
		Name: name,
		Age:  age,
	}
}

// GetName is a method with receiver
func (u *User) GetName() string {
	return u.Name
}

// SetAge is a method with value receiver
func (u User) SetAge(age int) {
	u.Age = age
}

// privateMethod is not exported
func (u *User) privateMethod() {
	// implementation
}

// Service interface
type Service interface {
	Process(data string) error
	Close() error
}

// Calculator struct with methods
type Calculator struct {
	value int
}

// Add method
func (c *Calculator) Add(x int) int {
	c.value += x
	return c.value
}

// Result type alias
type Result = map[string]interface{}

// Handler is a function type
type Handler func(string) error

// Generic constraint (Go 1.18+)
type Number interface {
	int | int64 | float64
}

// Generic function
func Sum[T Number](a, b T) T {
	return a + b
}
