const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "KGL API",
    version: "1.0.0",
    description: "Karibu Groceries LTD backend API documentation."
  },
  servers: [{ url: "http://localhost:5000" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["username", "password", "branch"],
        properties: {
          username: { type: "string" },
          password: { type: "string" },
          branch: { type: "string", enum: ["Maganjo", "Matugga", "All"] }
        }
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "role", "branch", "password"],
        properties: {
          name: { type: "string" },
          role: { type: "string", enum: ["director", "manager", "agent"] },
          branch: { type: "string", enum: ["Maganjo", "Matugga", "All"] },
          password: { type: "string" }
        }
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" }
        }
      }
    }
  },
  paths: {
    "/users/login": {
      post: {
        operationId: "userLogin",
        tags: ["Auth"],
        summary: "User Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" }
            }
          }
        },
        responses: {
          200: { description: "Authenticated" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" }
        }
      }
    },
    "/users/register": {
      post: {
        operationId: "userRegister",
        tags: ["Auth"],
        summary: "User Register",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" }
            }
          }
        },
        responses: {
          201: { description: "User created" },
          400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "User already exists", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/auth/login": {
      post: {
        operationId: "userLogin",
        tags: ["Auth"],
        summary: "User Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" }
            }
          }
        },
        responses: {
          200: { description: "Authenticated" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" }
        }
      }
    },
    "/api/products": {
      get: {
        tags: ["Catalog"],
        summary: "List products",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "OK" }, 401: { description: "Unauthorized" } }
      }
    },
    "/api/prices": {
      get: {
        tags: ["Pricing"],
        summary: "Get prices",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "OK" } }
      },
      put: {
        tags: ["Pricing"],
        summary: "Update prices (manager only)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Saved" }, 403: { description: "Forbidden" } }
      }
    },
    "/api/inventory": {
      get: {
        tags: ["Inventory"],
        summary: "Get inventory",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "OK" } }
      }
    },
    "/api/procurements": {
      post: {
        tags: ["Procurement"],
        summary: "Record procurement",
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: "Created" }, 400: { description: "Validation error" } }
      }
    },
    "/api/sales/cash": {
      post: {
        tags: ["Sales"],
        summary: "Record cash sale",
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: "Created" } }
      }
    },
    "/api/sales/credit": {
      post: {
        tags: ["Sales"],
        summary: "Record credit sale",
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: "Created" } }
      }
    },
    "/api/staff": {
      get: {
        tags: ["Staff"],
        summary: "Get staff (director only)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "OK" }, 403: { description: "Forbidden" } }
      },
      post: {
        tags: ["Staff"],
        summary: "Create staff (director only)",
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: "Created" }, 403: { description: "Forbidden" } }
      }
    },
    "/api/staff/{id}": {
      put: {
        tags: ["Staff"],
        summary: "Update staff (director only)",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Updated" } }
      },
      delete: {
        tags: ["Staff"],
        summary: "Delete staff (director only)",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } }
      }
    },
    "/api/account/me": {
      put: {
        tags: ["Account"],
        summary: "Update manager account",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Updated" } }
      }
    },
    "/api/director/aggregates": {
      get: {
        tags: ["Director"],
        summary: "Get director aggregates",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "OK" } }
      }
    },
    "/api/state": {
      get: {
        tags: ["State"],
        summary: "Get application state snapshot",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "OK" } }
      }
    }
  }
};

module.exports = { openApiSpec };
