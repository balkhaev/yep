//! Sample Rust module for testing parser

use std::collections::HashMap;
use std::fmt::Display;

// Module-level constants
pub const MAX_RETRIES: u32 = 3;
const API_URL: &str = "https://api.example.com";

// Module-level static
pub static COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

/// Simple function with parameters
pub fn simple_function(name: &str) -> String {
    format!("Hello, {}", name)
}

/// Function with multiple return values (tuple)
pub fn complex_function(id: u32, options: Vec<String>) -> Result<String, String> {
    Ok("result".to_string())
}

/// Generic function with constraints
pub fn generic_function<T: Display>(value: T) -> String {
    format!("{}", value)
}

/// Function with lifetimes
pub fn with_lifetime<'a>(s: &'a str) -> &'a str {
    s
}

/// User struct
#[derive(Debug, Clone)]
pub struct User {
    pub id: u32,
    pub name: String,
    age: u32,
}

/// Implementation block for User
impl User {
    /// Constructor
    pub fn new(name: String, age: u32) -> Self {
        Self {
            id: 0,
            name,
            age,
        }
    }

    /// Public method
    pub fn get_name(&self) -> &str {
        &self.name
    }

    /// Method with mutable self
    pub fn set_age(&mut self, age: u32) {
        self.age = age;
    }

    /// Private method
    fn internal_helper(&self) {
        // implementation
    }
}

/// Generic struct
pub struct Container<T> {
    value: T,
}

/// Generic impl block
impl<T> Container<T> {
    pub fn new(value: T) -> Self {
        Container { value }
    }

    pub fn get(&self) -> &T {
        &self.value
    }
}

/// Trait definition
pub trait Processor {
    fn process(&self, data: &str) -> Result<String, String>;
    fn validate(&self) -> bool;
}

/// Trait implementation
impl Processor for User {
    fn process(&self, data: &str) -> Result<String, String> {
        Ok(format!("{}: {}", self.name, data))
    }

    fn validate(&self) -> bool {
        !self.name.is_empty()
    }
}

/// Enum definition
#[derive(Debug)]
pub enum Status {
    Active,
    Inactive,
    Pending(String),
    Error { code: u32, message: String },
}

/// Enum implementation
impl Status {
    pub fn is_active(&self) -> bool {
        matches!(self, Status::Active)
    }
}

/// Type alias
pub type Result<T> = std::result::Result<T, String>;

/// Trait with associated types
pub trait Storage {
    type Item;
    fn store(&mut self, item: Self::Item);
    fn retrieve(&self) -> Option<&Self::Item>;
}

/// Generic trait with lifetimes
pub trait Parser<'a> {
    type Output;
    fn parse(&self, input: &'a str) -> Self::Output;
}

/// Async function
pub async fn async_function(url: &str) -> Result<String> {
    Ok("data".to_string())
}

/// Function with generic constraints
pub fn constrained_generic<T>(value: T) -> T
where
    T: Clone + Display,
{
    value
}
