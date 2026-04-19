# CLA API Development Standards

**Version**: 1.0  
**Last Updated**: March 27, 2026  
**Purpose**: Comprehensive guidelines for building compliant, production-ready REST APIs

---

## Table of Contents

1. [Repository Topology & Structure](#1-repository-topology--structure)
2. [OpenAPI Specifications](#2-openapi-specifications)
3. [API Versioning](#3-api-versioning)
4. [HTTP Methods & REST Standards](#4-http-methods--rest-standards)
5. [Response Standards & HTTP Status Codes](#5-response-standards--http-status-codes)
6. [Data Format & JSON Support](#6-data-format--json-support)
7. [Logging & Observability](#7-logging--observability)
8. [API Security](#8-api-security)
9. [API Naming Conventions](#9-api-naming-conventions)
10. [SOLID Principles](#10-solid-principles)
11. [Testing & Quality Standards](#11-testing--quality-standards)
12. [Contract-First Development](#12-contract-first-development)

---

## 1. Repository Topology & Structure

### Requirements

**Directory Structure** (MUST follow):

```
my-api-service/
├── docs/                          # Documentation
│   ├── openapi.yaml              # OpenAPI 3+ specification (REQUIRED)
│   └── ops/                      # Operational runbooks
├── postman/                      # Postman collections & tests
│   └── collections/
├── src/                          # Source code
│   ├── features/                 # Organized by feature
│   │   ├── users/
│   │   │   ├── v1/              # Version-specific implementation
│   │   │   └── v2/
│   │   └── products/
│   │       └── v1/
│   ├── shared/                   # Shared utilities
│   └── index.ts
├── tests/                        # Test files
│   ├── unit/
│   └── integration/
└── ops/                          # Operational configurations
```

### Key Principles

- **Feature-Based Organization**: Group code by business feature, not technical layer
- **URI Versioning**: Features own their versions (v1/, v2/, etc.)
- **Required Directories**: `docs/`, `postman/`, `src/`, `tests/`, `ops/`
- **OpenAPI Location**: MUST be in `docs/openapi.yaml` or `docs/openapi.json`

### Checklist

- [ ] Repository follows "by feature" modular structure
- [ ] URI versioning structure exists per feature
- [ ] All required directories present
- [ ] OpenAPI spec in correct location
- [ ] Operational runbooks in docs/ops/

---

## 2. OpenAPI Specifications

### Requirements

All services SHALL publish API specifications in **OpenAPI 3.0+** format in `/docs/`.

### Minimum Documentation Per Endpoint

Each endpoint MUST include:

1. **Description**
   - Summary of what the endpoint does
   - Business purpose and use cases

2. **Authentication**
   - Required OAuth scopes
   - Required roles/permissions

3. **Parameters**
   - Names, types, defaults
   - Constraints (min/max, regex patterns)
   - Examples for each parameter

4. **Request/Response Models**
   - JSON schemas with all fields
   - Data types and formats
   - Required vs optional fields

5. **HTTP Status Codes**
   - ALL expected status codes
   - Examples for each code
   - Error response schemas

6. **Error Format**
   - Standard error structure
   - Error codes and messages

7. **Examples**
   - At least ONE happy path example
   - At least ONE error example

8. **Additional Documentation**
   - Idempotency behavior
   - Pagination conventions (if applicable)
   - Sorting/Filtering options (if applicable)

### Example OpenAPI Structure

```yaml
openapi: 3.0.3
info:
  title: My API Service
  version: 1.0.0
  description: Comprehensive API service description

paths:
  /api/v1/Users/{userId}:
    get:
      summary: Get user by ID
      description: |
        Retrieves detailed information about a specific user.
        Business purpose: User profile management.
      security:
        - oauth2:
            - users:read
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          example: "123e4567-e89b-12d3-a456-426614174000"
      responses:
        "200":
          description: User found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
              examples:
                success:
                  value:
                    id: "123e4567-e89b-12d3-a456-426614174000"
                    email: "user@example.com"
                    name: "John Doe"
        "404":
          description: User not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              examples:
                notFound:
                  value:
                    error: "USER_NOT_FOUND"
                    message: "User with ID 123e4567-e89b-12d3-a456-426614174000 not found"
                    timestamp: "2026-03-27T12:00:00Z"
```

### Checklist

- [ ] OpenAPI spec file exists in `docs/`
- [ ] OpenAPI version is 3.0 or higher
- [ ] Each endpoint has complete documentation
- [ ] Examples present for happy path and errors
- [ ] Schemas defined and reused with `$ref`
- [ ] All response codes documented

---

## 3. API Versioning

### Requirements

All endpoints SHALL be versioned using **URI versioning**.

### Version Format

```
/api/v{major}.{minor}/ResourceName
```

Examples:

- `/api/v1/Users`
- `/api/v1.1/Users`
- `/api/v2/Users`

### Semantic Versioning

Follow **MAJOR.MINOR.PATCH** semantics:

- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: Backward-compatible new features
- **PATCH**: Backward-compatible bug fixes

### Version Access

- Specific version: `/api/v1/Users`
- Latest version: `/api/Users` (versionless URI points to latest)

### Backward Compatibility

MUST maintain backward compatibility within the same major version.

### Migration Strategy

When introducing breaking changes:

1. Create new major version (e.g., v2)
2. Maintain v1 for deprecation period
3. Document migration guide
4. Provide deprecation warnings

### Checklist

- [ ] All routes include version in URI
- [ ] Semantic versioning properly implemented
- [ ] Latest version accessible without explicit version
- [ ] Backward compatibility maintained within major version
- [ ] Migration documentation exists for version changes

---

## 4. HTTP Methods & REST Standards

### Supported Methods

- **GET** - Retrieve resources
- **POST** - Create new resources
- **PUT** - Update/replace entire resource
- **PATCH** - Partial update
- **DELETE** - Remove resource

### Method Specifications

#### GET

- **Safe**: MUST NOT modify server state
- **Idempotent**: Multiple identical requests = same result
- **No Body**: Parameters in query string or path only
- **Caching**: Should support caching headers

#### POST

- **Creates Resources**: Returns 201 with Location header
- **Not Idempotent**: Multiple requests create multiple resources
- **Request Body**: Contains resource data
- **Response**: Returns created resource

#### PUT

- **Replaces Entire Resource**: All fields specified
- **Idempotent**: Multiple identical requests = same result
- **Full Resource**: Requires complete resource representation
- **Response**: 200 OK or 204 No Content

#### PATCH

- **Partial Update**: Only modified fields sent
- **May Include Actions**: Can trigger additional operations
- **Request Body**: Contains only fields to update
- **Response**: 200 OK with updated resource

#### DELETE

- **Removes Resource**: Permanently deletes
- **Idempotent**: Multiple identical requests = same result
- **Response**: 204 No Content or 200 OK

### REST Best Practices

1. **Resource-Oriented**: URLs represent resources, not actions
2. **HTTP Methods Define Action**: Don't use verbs in URLs
3. **Stateless**: Each request contains all necessary information
4. **Hierarchical**: Represent relationships in URL structure

### Examples

```
✅ CORRECT
GET    /api/v1/Users           - List users
GET    /api/v1/Users/123       - Get specific user
POST   /api/v1/Users           - Create user
PUT    /api/v1/Users/123       - Replace user
PATCH  /api/v1/Users/123       - Update user fields
DELETE /api/v1/Users/123       - Delete user

❌ INCORRECT
GET    /api/v1/getUsers        - Verb in URL
POST   /api/v1/createUser      - Verb in URL
GET    /api/v1/Users/123/delete - GET for deletion
```

### Checklist

- [ ] All HTTP methods used correctly
- [ ] GET requests don't modify state
- [ ] PUT operations are idempotent
- [ ] DELETE operations are idempotent
- [ ] PATCH used appropriately for partial updates
- [ ] No verbs in URLs (methods define actions)

---

## 5. Response Standards & HTTP Status Codes

### Status Code Requirements

Use **SPECIFIC** status codes, NOT generic ones (300, 400, 500).

### Success Codes (2XX)

| Code               | Usage                      | Response Body                      |
| ------------------ | -------------------------- | ---------------------------------- |
| **200 OK**         | Successful GET, PUT, PATCH | Resource data                      |
| **201 Created**    | Successful POST            | Created resource + Location header |
| **204 No Content** | Successful DELETE or PUT   | No body                            |

### Redirection Codes (3XX)

| Code                       | Usage                                |
| -------------------------- | ------------------------------------ |
| **301 Moved Permanently**  | Resource permanently moved           |
| **302 Found**              | Temporary redirect                   |
| **304 Not Modified**       | Cache validation                     |
| **307 Temporary Redirect** | Temporary redirect (preserve method) |
| **308 Permanent Redirect** | Permanent redirect (preserve method) |

### Client Error Codes (4XX)

| Code                         | Usage                                         |
| ---------------------------- | --------------------------------------------- |
| **400 Bad Request**          | Invalid syntax/validation errors              |
| **401 Unauthorized**         | Missing or invalid authentication             |
| **403 Forbidden**            | Authenticated but not authorized              |
| **404 Not Found**            | Resource doesn't exist                        |
| **409 Conflict**             | Conflict with current state (e.g., duplicate) |
| **422 Unprocessable Entity** | Validation errors                             |
| **429 Too Many Requests**    | Rate limit exceeded                           |

### Server Error Codes (5XX)

| Code                          | Usage                          |
| ----------------------------- | ------------------------------ |
| **500 Internal Server Error** | Unexpected server error        |
| **501 Not Implemented**       | Functionality not implemented  |
| **502 Bad Gateway**           | Invalid response from upstream |
| **503 Service Unavailable**   | Temporarily unavailable        |
| **504 Gateway Timeout**       | Upstream timeout               |

### Standard Error Format

All error responses MUST follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2026-03-27T12:00:00Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Error Response Guidelines

1. **Specific Codes**: Use most specific status code
2. **Informative Messages**: Clear, actionable error messages
3. **Include Request ID**: For tracing and support
4. **Validation Details**: List all validation errors
5. **No Sensitive Data**: Don't expose internal details
6. **Consistent Structure**: Same format across all endpoints

### Checklist

- [ ] Responses use specific status codes
- [ ] 201 returned for resource creation with Location header
- [ ] 204 used for DELETE operations
- [ ] Proper 4XX codes (401, 403, 404, 409)
- [ ] Error responses are informative and consistent
- [ ] Standard error format implemented
- [ ] Request IDs included in error responses

---

## 6. Data Format & JSON Support

### Primary Format

APIs **SHOULD** support **JSON** as the primary data format (golden path).

### Content-Type Headers

```
Request:  Content-Type: application/json
Response: Content-Type: application/json
```

### JSON Guidelines

1. **camelCase**: Use camelCase for property names
2. **ISO 8601**: Use for dates (`2026-03-27T12:00:00Z`)
3. **Null vs Omit**: Omit optional fields rather than returning null
4. **Arrays**: Use arrays for collections, even single items
5. **Nested Objects**: Keep nesting reasonable (max 3-4 levels)

### Example JSON Response

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2026-03-27T12:00:00Z",
  "roles": ["user", "admin"],
  "metadata": {
    "lastLogin": "2026-03-27T11:30:00Z",
    "loginCount": 42
  }
}
```

### Other Formats

Other formats (XML, HTML, plain text) MUST:

- Be justified by specific use cases
- Be documented in OpenAPI specification
- Use appropriate Content-Type headers
- Support content negotiation via Accept header

### Checklist

- [ ] JSON is default request/response format
- [ ] Content-Type headers correctly set
- [ ] JSON follows naming conventions (camelCase)
- [ ] Dates in ISO 8601 format
- [ ] Non-JSON formats documented in OpenAPI

---

## 7. Logging & Observability

### Logging Requirements

APIs SHALL implement **structured JSON logging** with correlation IDs.

### Required Log Fields

Every log entry MUST include:

```json
{
  "timestamp": "2026-03-27T12:00:00.123Z",
  "level": "INFO",
  "message": "User login successful",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "method": "POST",
  "path": "/api/v1/Auth/Login",
  "statusCode": 200,
  "latencyMs": 45,
  "clientIp": "192.168.1.xxx",
  "service": "user-api",
  "version": "1.2.3",
  "environment": "production"
}
```

### Sensitive Data Protection

**NEVER** log:

- Passwords or tokens
- API keys or secrets
- Full credit card numbers
- Social security numbers
- Other PII without anonymization

**DO** log anonymized data:

- Masked IPs (last octet: 192.168.1.xxx)
- Hashed identifiers
- Partial data (last 4 digits of card)

### Distributed Tracing

Implement **W3C Trace Context** standard:

- `traceparent` header propagation
- `tracestate` header support
- Integration with tracing systems (OpenTelemetry)

### Metrics & Monitoring

#### Required Metrics

1. **Request Metrics**
   - Request count (per endpoint, per status code)
   - Request rate (requests/second)

2. **Error Metrics**
   - Error count (by error type)
   - Error rate (errors/total requests)

3. **Latency Metrics**
   - P50, P95, P99 latency
   - Average response time

4. **Saturation Metrics**
   - CPU usage
   - Memory usage
   - Connection pool utilization

5. **Dependency Metrics**
   - Database query time
   - External API call latency
   - Cache hit/miss ratio

#### Dashboards

Create dashboards showing:

- Service health overview
- Request/error rates
- Latency percentiles
- Resource utilization

#### Alerts

Configure alerts for:

- Error rate exceeds threshold
- Latency exceeds SLA
- Service availability drops
- Resource exhaustion

### Operational Documentation

Maintain in `docs/ops/`:

- Incident runbooks
- Troubleshooting guides
- Alert response procedures
- Escalation paths

### Checklist

- [ ] Structured JSON logging implemented
- [ ] All required log fields present
- [ ] Correlation IDs (requestId, traceId, spanId)
- [ ] Sensitive data NOT logged
- [ ] W3C Trace Context support
- [ ] Metrics collection configured
- [ ] Dashboards created
- [ ] Alerts configured
- [ ] Runbooks in docs/ops/

---

## 8. API Security

### Authentication

Use **OAuth 2.0** or **OpenID Connect** for authentication.

#### Token Validation

Validate ALL of the following:

- **Issuer** (`iss` claim): Verify token issuer
- **Audience** (`aud` claim): Verify intended recipient
- **Scopes**: Check required scopes present
- **Roles**: Verify user has required roles
- **Signature**: Cryptographically verify signature
- **Expiration** (`exp` claim): Ensure token not expired
- **Not Before** (`nbf` claim): Check token validity time

#### Token Example

```json
{
  "iss": "https://auth.company.com",
  "aud": "user-api",
  "sub": "user-123",
  "exp": 1648387200,
  "iat": 1648383600,
  "scopes": ["users:read", "users:write"],
  "roles": ["user", "admin"]
}
```

### Authorization

Protect ALL routes with appropriate authorization:

```typescript
// Example middleware
async function authorize(requiredScopes: string[]) {
  return async (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    const validated = await validateToken(token);

    if (!hasRequiredScopes(validated, requiredScopes)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    req.user = validated;
    next();
  };
}

// Usage
app.get("/api/v1/Users/:id", authorize(["users:read"]), getUserHandler);
```

### Input Validation

Validate and sanitize ALL incoming data:

1. **Schema Validation**: Use JSON Schema or validation library
2. **Type Checking**: Ensure correct data types
3. **Range Validation**: Check min/max values
4. **Format Validation**: Validate email, URL, UUID formats
5. **Whitelist Approach**: Accept only known good input

### Injection Prevention

#### SQL Injection

Always use **parameterized queries**:

```typescript
✅ CORRECT (Parameterized)
const user = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

❌ INCORRECT (String concatenation)
const user = await db.query(
  `SELECT * FROM users WHERE id = '${userId}'`
);
```

#### NoSQL Injection

Validate input before database queries:

```typescript
✅ CORRECT
const userId = validateUUID(req.params.id);
const user = await db.collection('users').findOne({ _id: userId });

❌ INCORRECT
const user = await db.collection('users').findOne({
  _id: req.params.id
});
```

#### XSS Prevention

1. Escape output when rendering HTML
2. Use Content-Security-Policy headers
3. Validate and sanitize user input
4. Use frameworks with automatic escaping

#### Command Injection

Never execute shell commands with user input:

```typescript
❌ NEVER DO THIS
exec(`ping ${userInput}`);
```

### Secrets Management

**NEVER** hardcode secrets in code:

```typescript
❌ INCORRECT
const apiKey = 'sk_live_abc123xyz789';

✅ CORRECT
const apiKey = process.env.API_KEY;
```

**Best Practices**:

- Use environment variables
- Use secret management services (AWS Secrets Manager, Azure Key Vault)
- Rotate secrets regularly
- Limit secret access via IAM roles
- Never commit secrets to git

### Security Headers

Implement security headers:

```typescript
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  next();
});
```

### Checklist

- [ ] OAuth 2.0/OIDC authentication implemented
- [ ] Token validation complete (issuer, aud, exp, signature)
- [ ] All routes protected with authorization
- [ ] Input validation middleware present
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevention measures in place
- [ ] No hardcoded secrets or tokens
- [ ] Security headers configured
- [ ] Secrets in environment variables or secret manager

---

## 9. API Naming Conventions

### Resource Naming

Use **nouns** for resources, NOT verbs:

```
✅ CORRECT
/api/v1/Users
/api/v1/Products
/api/v1/Orders

❌ INCORRECT
/api/v1/getUsers
/api/v1/createProduct
/api/v1/deleteOrder
```

### Casing Convention

Use **Pascal Case** for route naming:

```
✅ CORRECT
/api/v1/Users
/api/v1/UserProfiles
/api/v1/OrderItems

❌ INCORRECT
/api/v1/users
/api/v1/user-profiles
/api/v1/order_items
```

### Collection Naming

Use **plural nouns** for collections:

```
✅ CORRECT
GET /api/v1/Users          - Collection of users
GET /api/v1/Photos         - Collection of photos

❌ INCORRECT
GET /api/v1/User
GET /api/v1/Photo
```

### Special Characters

**Avoid** special characters in URLs:

```
✅ CORRECT
/api/v1/UserProfiles

❌ INCORRECT
/api/v1/user-profiles      - Hyphens
/api/v1/user_profiles      - Underscores
/api/v1/user.profiles      - Dots
```

### HTTP Methods Describe Actions

Let HTTP methods define the action, not the URL:

```
✅ CORRECT
GET    /api/v1/Users/123       - Get user
POST   /api/v1/Users           - Create user
PUT    /api/v1/Users/123       - Update user
DELETE /api/v1/Users/123       - Delete user

❌ INCORRECT
GET    /api/v1/Users/123/get
POST   /api/v1/Users/create
PUT    /api/v1/Users/123/update
DELETE /api/v1/Users/123/delete
```

### Resource Relationships

Express relationships hierarchically:

```
✅ CORRECT
GET /api/v1/Users/123/Orders              - User's orders
GET /api/v1/Users/123/Orders/456          - Specific user order
GET /api/v1/Products/789/Reviews          - Product reviews

✅ ALSO ACCEPTABLE (for many-to-many)
GET /api/v1/Orders?userId=123             - Filter orders by user
```

### Query Parameters

Use for filtering, sorting, pagination:

```
GET /api/v1/Users?role=admin&status=active&sort=createdAt&page=2&limit=50
```

### Checklist

- [ ] Resource names are nouns (not verbs)
- [ ] Pascal Case used for routes
- [ ] Collections use plural forms
- [ ] No special characters (hyphens, underscores)
- [ ] HTTP methods describe functionality
- [ ] Hierarchical structure for relationships
- [ ] Query parameters for filtering/sorting/paging

---

## 10. SOLID Principles

Apply SOLID principles to API design:

### Single Responsibility Principle

**One endpoint = One purpose**

```
✅ CORRECT
POST /api/v1/Users              - Create user
PUT  /api/v1/Users/123          - Update user

❌ INCORRECT
POST /api/v1/Users?action=create-or-update  - Multiple actions
```

Each endpoint should have a single, well-defined purpose.

### Open/Closed Principle

**Extensible without breaking changes**

Use versioning to extend functionality:

```
✅ CORRECT
/api/v1/Users    - Original implementation
/api/v2/Users    - Extended with new features

DON'T break existing v1 clients when adding v2
```

### Liskov Substitution Principle

**Maintain backward compatibility**

New versions should honor contracts of old versions:

```
✅ CORRECT
- v1 returns: { id, name }
- v2 returns: { id, name, email }  - Additive change

❌ INCORRECT
- v1 returns: { id, name }
- v2 returns: { userId, fullName }  - Breaking change without new major version
```

### Interface Segregation Principle

**Focused, granular endpoints**

Don't create "fat" endpoints that return everything:

```
✅ CORRECT
GET /api/v1/Users/123                    - Basic user info
GET /api/v1/Users/123/Profile            - Detailed profile
GET /api/v1/Users/123/Orders             - User's orders
GET /api/v1/Users/123/Preferences        - User preferences

❌ INCORRECT
GET /api/v1/Users/123?include=everything - Monolithic response
```

Let clients request only what they need.

### Dependency Inversion Principle

**Depend on abstractions (contracts)**

Define contracts via OpenAPI specifications:

1. Write OpenAPI spec first (contract)
2. Generate server stubs from spec
3. Implement against the contract
4. Generate client SDKs from spec

This ensures loose coupling between API and clients.

### Checklist

- [ ] Endpoints have single responsibility
- [ ] Versioning enables extension without breaking changes
- [ ] Backward compatibility maintained
- [ ] Endpoints are focused and granular
- [ ] No "fat" endpoints that return everything
- [ ] OpenAPI contract defined before implementation

---

## 11. Testing & Quality Standards

### Test Coverage

**Minimum 85% code coverage** required.

### Test Types

#### Unit Tests

Test individual components in isolation:

```typescript
describe("UserService", () => {
  it("should create user with valid data", async () => {
    const userData = { email: "test@example.com", name: "Test" };
    const user = await userService.create(userData);
    expect(user.id).toBeDefined();
    expect(user.email).toBe("test@example.com");
  });

  it("should throw error for invalid email", async () => {
    const userData = { email: "invalid", name: "Test" };
    await expect(userService.create(userData)).rejects.toThrow();
  });
});
```

#### Integration Tests

Test API endpoints end-to-end:

```typescript
describe("POST /api/v1/Users", () => {
  it("should create user and return 201", async () => {
    const response = await request(app)
      .post("/api/v1/Users")
      .send({ email: "test@example.com", name: "Test" })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.headers.location).toContain("/api/v1/Users/");
  });

  it("should return 400 for invalid data", async () => {
    const response = await request(app)
      .post("/api/v1/Users")
      .send({ email: "invalid" })
      .expect(400);

    expect(response.body.error).toBeDefined();
  });
});
```

#### Contract Tests

Validate against OpenAPI specification:

```typescript
it("should match OpenAPI schema", async () => {
  const response = await request(app).get("/api/v1/Users/123");
  const validation = validator.validate(response.body, schema);
  expect(validation.errors).toHaveLength(0);
});
```

### Test Coverage Areas

Test these scenarios:

1. **Happy Path**: Successful operations
2. **Validation Errors**: Invalid input
3. **Not Found**: Missing resources
4. **Authentication**: Missing/invalid tokens
5. **Authorization**: Insufficient permissions
6. **Conflict**: Duplicate resources
7. **Server Errors**: Unexpected failures
8. **Edge Cases**: Boundary conditions

### Code Quality Tools

#### ESLint

Configure ESLint for TypeScript/JavaScript:

```json
{
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "no-console": "error",
    "no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

#### Prettier

Format code consistently:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Quality Gates

**Before commit**:

- [ ] All tests pass
- [ ] No ESLint errors
- [ ] Code formatted with Prettier
- [ ] Coverage meets minimum (85%)

**CI/CD Pipeline**:

- [ ] Run all tests
- [ ] Check code coverage
- [ ] Run linter
- [ ] Build succeeds
- [ ] Security scan passes

### Checklist

- [ ] 85%+ code coverage achieved
- [ ] Unit tests for all components
- [ ] Integration tests for all endpoints
- [ ] Edge cases and error scenarios tested
- [ ] ESLint configured and passing
- [ ] Prettier configured
- [ ] All linter errors addressed
- [ ] CI/CD pipeline includes quality checks

---

## 12. Contract-First Development

### Design-First Approach

Follow this workflow:

1. **Design** → Write OpenAPI specification
2. **Review** → Validate spec with stakeholders
3. **Generate** → Generate server stubs and client SDKs
4. **Implement** → Write business logic
5. **Test** → Validate against contract
6. **Deploy** → Release API

### OpenAPI Specification First

Always write OpenAPI spec BEFORE coding:

```yaml
# docs/openapi.yaml - Written FIRST
openapi: 3.0.3
info:
  title: User API
  version: 1.0.0

paths:
  /api/v1/Users:
    post:
      summary: Create new user
      # ... full specification
```

Benefits:

- Clear contract before implementation
- Generate code from spec (reduces errors)
- Validation built-in
- Documentation auto-generated
- Client SDKs auto-generated

### Postman Collections

Create Postman collections with:

1. **All Endpoints**: Cover every API operation
2. **Examples**: Happy path and error cases
3. **Variables**: Environment-based configuration
4. **Test Scripts**: Automated validation

#### Example Postman Test

```javascript
pm.test("Status code is 201", function () {
  pm.response.to.have.status(201);
});

pm.test("Response has user ID", function () {
  const json = pm.response.json();
  pm.expect(json.id).to.be.a("string");
});

pm.test("Location header present", function () {
  pm.response.to.have.header("Location");
});
```

### Postman Automation

Integrate Postman in CI/CD:

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Run Postman Collection
        uses: matt-ball/newman-action@v1
        with:
          collection: postman/collections/user-api.json
          environment: postman/environments/dev.json
```

### GitHub Actions Integration

```yaml
name: API Workflow

on:
  push:
    branches: [main, develop]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Validate OpenAPI Spec
        run: |
          npm install -g @stoplight/spectral
          spectral lint docs/openapi.yaml

      - name: Run Tests
        run: npm test

      - name: Run Postman Tests
        uses: matt-ball/newman-action@v1
        with:
          collection: postman/collections/api-tests.json

      - name: Check Coverage
        run: npm run coverage
```

### Postman + Git Integration

Link Postman workspace to Git repository:

1. Create Postman workspace
2. Connect to GitHub repository
3. Sync collections and environments
4. Enable version control
5. Pull changes in CI/CD

### Checklist

- [ ] OpenAPI spec written before implementation
- [ ] Postman collection created with all endpoints
- [ ] Postman test scripts for validation
- [ ] Examples for happy path and errors
- [ ] GitHub Actions configured
- [ ] Postman CLI integrated in CI/CD
- [ ] Git repository linked to Postman
- [ ] Automated testing in pipeline

---

## Summary Checklist

Use this comprehensive checklist when building new APIs:

### 📁 Structure

- [ ] Feature-based directory structure
- [ ] Versioning structure (v1/, v2/)
- [ ] All required directories present

### 📄 Documentation

- [ ] OpenAPI 3.0+ spec complete
- [ ] All endpoints fully documented
- [ ] Examples for success and error cases
- [ ] Operational runbooks created

### 🔢 Versioning

- [ ] URI versioning implemented
- [ ] Semantic versioning followed
- [ ] Backward compatibility maintained

### 🌐 REST Standards

- [ ] HTTP methods used correctly
- [ ] Proper status codes (specific, not generic)
- [ ] Standard error format implemented
- [ ] JSON as primary format

### 📊 Observability

- [ ] Structured logging with correlation IDs
- [ ] Sensitive data not logged
- [ ] Metrics collection configured
- [ ] Dashboards and alerts created

### 🔒 Security

- [ ] OAuth 2.0/OIDC authentication
- [ ] Token validation complete
- [ ] All routes authorized
- [ ] Input validation and sanitization
- [ ] Injection prevention (SQL, XSS, etc.)
- [ ] No hardcoded secrets

### 🏷️ Naming

- [ ] Nouns for resources
- [ ] Pascal Case for routes
- [ ] Plural for collections
- [ ] HTTP methods define actions

### 🎯 Design Principles

- [ ] Single responsibility per endpoint
- [ ] Extensible via versioning
- [ ] Backward compatible
- [ ] Focused endpoints (not "fat")

### ✅ Testing & Quality

- [ ] 85%+ code coverage
- [ ] Unit and integration tests
- [ ] ESLint and Prettier configured
- [ ] All linter errors resolved

### 📝 Contract-First

- [ ] OpenAPI spec first
- [ ] Postman collection created
- [ ] Postman tests automated
- [ ] CI/CD integration complete

---

## Additional Resources

### Tools

- **OpenAPI Editors**: Swagger Editor, Stoplight Studio
- **Validation**: Spectral, openapi-validator
- **Testing**: Postman, Newman, Jest, Supertest
- **Linting**: ESLint, Prettier
- **Observability**: OpenTelemetry, Prometheus, Grafana
- **Security**: OWASP ZAP, Snyk

### References

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [REST API Guidelines](https://restfulapi.net/)
- [OAuth 2.0 RFC](https://oauth.net/2/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

---

**Version History**

| Version | Date       | Changes                                  |
| ------- | ---------- | ---------------------------------------- |
| 1.0     | 2026-03-27 | Initial comprehensive standards document |

---

_This document should be reviewed and updated quarterly to reflect evolving best practices and organizational needs._
