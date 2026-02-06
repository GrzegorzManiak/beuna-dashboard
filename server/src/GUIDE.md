# 🚀 **Programming Practices Guide**

This guide outlines the best practices and standards for writing clean, maintainable, and efficient code within our projects. Adhering to these guidelines ensures consistency, improves collaboration, and reduces the likelihood of bugs.

---

## **1. Code Style & Readability**

### **1.1 Conditional Statements**

*   **Ternary (Inline) Conditionals:** For simple assignments or returns based on a condition, prefer ternary operators.

    ```typescript
    const isProduction = process.env.NODE_ENV === "production";
    const isDevelopment = process.env.NODE_ENV === "development";
    const isTest = process.env.NODE_ENV === "test";
    ```

*   **Guard Clauses & Early Returns:** Utilize guard clauses and early returns to minimize nesting and improve readability. This pattern validates conditions at the beginning of a function, exiting early if a condition is not met.

    ```typescript
    function processValue(value: string): string {
        if (!value) return "Error: Value is required.";
        if (value.length < 5) return "Error: Value must be at least 5 characters long.";
        
        // ... rest of the function logic
        return "Value processed successfully.";
    }
    ```

*   **Single-Line `if` Statements:** When an `if` statement's block contains only a single line of code, it should reside on the same line as the condition.

    ```typescript
    if (isProduction) return "Running in production mode.";
    ```

### **1.2 Indentation & Nesting**

*   **Minimal Indentation:** Keep indentation levels to a minimum. If you find yourself with more than **two levels of nesting**, consider refactoring your code. This often indicates a need for guard clauses, breaking logic into smaller functions, or employing design patterns to simplify complexity.

### **1.3 Naming Conventions**

*   **Descriptive Naming:** Function and variable names must be descriptive, clearly indicating their purpose or the data they hold.
    *   **Good:** `getUserById`, `calculateTotalPrice`, `formatUserData`
    *   **Bad:** `getUser`, `calculate`, `format`
*   **`camelCase`:** All function, variable, and property names must use `camelCase`.
*   **Constants:** Global constants should be named in `SCREAMING_SNAKE_CASE`.

### **1.4 Side Effects**

*   **Pure Functions:** Strive for functions with **as close to zero side effects as possible**. A function should ideally do one thing and do it well, returning a result based solely on its inputs without modifying external state or performing I/O operations directly (unless it's explicitly an I/O function).
*   **Single Responsibility Principle:** If a function is performing more than one distinct task, consider breaking it into smaller, more focused functions. This enhances testability and maintainability.

---

## **2. Types & Functions**

### **2.1 Type Definitions**

*   **Fully Defined Types:** We require **fully defined types** for all variables, function parameters, and return values. Avoid `any` or `unknown` unless absolutely necessary and explicitly justified (e.g., when dealing with truly unknown external data that is immediately validated).
*   **Interfaces & Types:** Define interfaces or types for complex objects to enforce structure and enable compile-time error checking.

    ```typescript
    interface User {
        id: string;
        name: string;
        email: string;
        isActive: boolean;
    }

    function displayUser(user: User): void {
        console.log(`User ID: ${user.id}, Name: ${user.name}`);
    }
    ```

### **2.2 Function Declarations**

*   **Named Function Declarations:** Prefer **named function declarations** over arrow functions for top-level functions or functions that are not immediately used as callbacks. This improves readability, aids in debugging (stack traces show function names), and simplifies testing.

    ```typescript
    // Bad (for top-level declarations)
    const add = (a: number, b: number): number => a + b;

    // Good
    function add(a: number, b: number): number {
        return a + b;
    }
    ```
    *   *Note:* Arrow functions are acceptable and encouraged for short, inline callbacks (e.g., `array.map(item => item.id)`).

---

## **3. Modules & Exports**

### **3.1 No Default Exports**

*   **Named Exports Only:** We **do not use default exports**. All exports must be named exports. This prevents naming conflicts, improves tree-shaking, and makes code easier to trace and refactor.

    ```typescript
    // Bad
    // export default function someFunction() { ... }

    // Good
    export function someFunction() { /* ... */ }
    export const SOME_CONSTANT = "value";
    ```

### **3.2 Export Order**

*   Within an `export` block, maintain the following order for consistency:

    1.  **Functions First:** All named function exports.
    2.  **Constants Second:** All named constant exports.
    3.  **Types Last:** All named type and interface exports.

    ```typescript
    export {
        // Functions
        getUserById,
        calculateTotalPrice,
        
        // Constants
        API_VERSION,
        DEFAULT_PAGINATION_LIMIT,
        
        // Types
        type User,
        type Product,
        type OrderStatus,
    };
    ```

---

## **4. Project Structure**

### **4.1 Standard Folder Structure**

The following folder structure is **mandatory** and must not be deviated from. It promotes clear separation of concerns, simplifies navigation, and enforces a modular architecture.

```
src/
  server.ts                 # Main entry point for the HTTP server setup
  app.ts                    # Application core logic, middleware, and route registration

  plugins/                  # Reusable components that extend application functionality
    env.ts                  # Environment variable configuration and validation
    db.ts                   # Database connection and ORM initialization
    auth.ts                 # Authentication strategies and middleware

  features/                 # Domain-specific modules, each owning its functionality
    health/                 # Example feature: Health check endpoints
      health.routes.ts      # Route definitions for the health feature
      health.handlers.ts    # Request handlers/controllers for the health feature
      health.schemas.ts     # Request/response validation schemas (e.g., Zod, Joi)

    users/                  # Example feature: User management
      users.routes.ts       # Route definitions for user management
      users.handlers.ts     # Request handlers/controllers for user management
      users.service.ts      # Business logic and data access for users (e.g., interacting with DB)
      users.schemas.ts      # Request/response validation schemas for users

  lib/                      # General utility modules, not tied to specific features
    errors.ts               # Custom error classes and error handling utilities
    logger.ts               # Centralized logging configuration and utilities
    types.ts                # Global type definitions and interfaces
```

Comments are an ANTI-PATTERN. The folder structure should be self-explanatory, and the code should be clear enough that comments are not necessary to understand the purpose of files or their contents. IF you find a need to add a comment, consider whether the code can be refactored for clarity instead, we prefer self-documenting code over comments, and clarity over cleverness. lenght is not necessarily a problem if the code is clear and well-structured. DRY is not a hard rule, and sometimes repetition can be more clear than abstraction.

**DO NOT DEVIATE FROM THIS STRUCTURE.**