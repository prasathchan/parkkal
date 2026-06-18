import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Parkkal API",
    version: "1.0.0",
    description: "REST API for Parkkal — dental clinic management SaaS. All endpoints require a valid session cookie obtained via POST /api/auth/login.",
    contact: { name: "Parkkal Support", email: "support@parkkal.app" },
  },
  servers: [{ url: "/api", description: "Current deployment" }],
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "pk_session", description: "JWT session cookie issued by POST /api/auth/login" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "array", items: { type: "object" } },
        },
      },
      Patient: {
        type: "object",
        properties: {
          id:          { type: "string" },
          patientCode: { type: "string", example: "PKL-000042" },
          name:        { type: "string" },
          phone:       { type: "string" },
          email:       { type: "string", nullable: true },
          dateOfBirth: { type: "string", format: "date", nullable: true },
          gender:      { type: "string", enum: ["MALE","FEMALE","OTHER"], nullable: true },
          bloodGroup:  { type: "string", nullable: true },
          createdAt:   { type: "integer", description: "Unix ms timestamp" },
        },
      },
      Visit: {
        type: "object",
        properties: {
          id:           { type: "string" },
          visitCode:    { type: "string", example: "V00001" },
          patientId:    { type: "string" },
          patientName:  { type: "string" },
          doctorId:     { type: "string" },
          visitDate:    { type: "string", format: "date" },
          visitType:    { type: "string", enum: ["APPOINTMENT","WALKIN"] },
          status:       { type: "string", enum: ["OPEN","COMPLETED","CANCELLED"] },
          chiefComplaint: { type: "string", nullable: true },
          totalAmount:  { type: "number" },
          paidAmount:   { type: "number" },
          balanceDue:   { type: "number" },
          billingStatus: { type: "string", enum: ["UNPAID","PARTIAL","PAID","OVERPAID"] },
        },
      },
      Appointment: {
        type: "object",
        properties: {
          id:               { type: "string" },
          patientId:        { type: "string" },
          patientName:      { type: "string", nullable: true },
          doctorId:         { type: "string" },
          appointmentDate:  { type: "string", format: "date" },
          appointmentTime:  { type: "string", example: "10:30" },
          durationMinutes:  { type: "integer" },
          type:             { type: "string", enum: ["CHECKUP","FOLLOWUP","PROCEDURE","EMERGENCY","CONSULTATION"] },
          status:           { type: "string", enum: ["SCHEDULED","IN_PROGRESS","COMPLETED","CANCELLED","NO_SHOW"] },
          notes:            { type: "string", nullable: true },
          visitId:          { type: "string", nullable: true },
        },
      },
      Treatment: {
        type: "object",
        properties: {
          id:           { type: "string" },
          patientId:    { type: "string" },
          visitId:      { type: "string", nullable: true },
          description:  { type: "string" },
          procedure:    { type: "string" },
          toothNumber:  { type: "string", nullable: true },
          status:       { type: "string", enum: ["PLANNED","IN_PROGRESS","COMPLETED","CANCELLED"] },
          cost:         { type: "number" },
          consentStatus: { type: "string", enum: ["NOT_REQUIRED","PENDING","SIGNED","OVERRIDE"] },
        },
      },
    },
  },
  security: [{ sessionCookie: [] }],
  paths: {
    "/auth/login": {
      post: {
        summary: "Log in",
        security: [],
        tags: ["Auth"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email","password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } } } } },
        responses: {
          200: { description: "Login successful — sets pk_session cookie", content: { "application/json": { schema: { type: "object", properties: { user: { type: "object" } } } } } },
          401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/logout": {
      post: { summary: "Log out", tags: ["Auth"], responses: { 200: { description: "Session cleared" } } },
    },
    "/auth/me": {
      get: { summary: "Get current session", tags: ["Auth"], responses: { 200: { description: "Current user and org", content: { "application/json": { schema: { type: "object", properties: { user: { type: "object" }, org: { type: "object" } } } } } } } },
    },
    "/patients": {
      get: {
        summary: "List patients",
        tags: ["Patients"],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Search by name or phone" },
          { name: "limit",  in: "query", schema: { type: "integer", default: 25, maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { description: "Paginated patient list", content: { "application/json": { schema: { type: "object", properties: { patients: { type: "array", items: { $ref: "#/components/schemas/Patient" } }, total: { type: "integer" } } } } } } },
      },
      post: {
        summary: "Create patient",
        tags: ["Patients"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name","phone"], properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, dateOfBirth: { type: "string", format: "date" }, gender: { type: "string", enum: ["MALE","FEMALE","OTHER"] }, bloodGroup: { type: "string" }, medicalHistory: { type: "string" } } } } } },
        responses: { 201: { description: "Patient created", content: { "application/json": { schema: { type: "object", properties: { patient: { $ref: "#/components/schemas/Patient" } } } } } } },
      },
    },
    "/patients/import": {
      post: {
        summary: "Bulk import patients from CSV data",
        tags: ["Patients"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["patients"], properties: { patients: { type: "array", maxItems: 1000, items: { type: "object", required: ["name","phone"], properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, dateOfBirth: { type: "string", format: "date" }, gender: { type: "string" }, bloodGroup: { type: "string" }, medicalNotes: { type: "string" } } } } } } } } },
        responses: { 200: { description: "Import result", content: { "application/json": { schema: { type: "object", properties: { imported: { type: "integer" }, errors: { type: "array" }, total: { type: "integer" } } } } } } },
      },
    },
    "/patients/{id}": {
      get: { summary: "Get patient", tags: ["Patients"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Patient detail" }, 404: { description: "Not found" } } },
      patch: { summary: "Update patient", tags: ["Patients"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Updated patient" } } },
      delete: { summary: "Delete patient", tags: ["Patients"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deleted" }, 403: { description: "Requires ADMIN role" } } },
    },
    "/visits": {
      get: {
        summary: "List visits",
        tags: ["Visits"],
        parameters: [
          { name: "patientId", in: "query", schema: { type: "string" } },
          { name: "status",    in: "query", schema: { type: "string", enum: ["OPEN","COMPLETED","CANCELLED"] } },
          { name: "search",    in: "query", schema: { type: "string" } },
          { name: "limit",     in: "query", schema: { type: "integer", default: 25 } },
          { name: "offset",    in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { description: "Paginated visits", content: { "application/json": { schema: { type: "object", properties: { visits: { type: "array", items: { $ref: "#/components/schemas/Visit" } }, total: { type: "integer" } } } } } } },
      },
      post: {
        summary: "Create visit",
        tags: ["Visits"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["patientId","doctorId","visitDate"], properties: { patientId: { type: "string" }, doctorId: { type: "string" }, visitDate: { type: "string", format: "date" }, visitType: { type: "string", enum: ["APPOINTMENT","WALKIN"] }, chiefComplaint: { type: "string" }, appointmentId: { type: "string" } } } } } },
        responses: { 201: { description: "Visit created", content: { "application/json": { schema: { type: "object", properties: { visit: { $ref: "#/components/schemas/Visit" } } } } } } },
      },
    },
    "/visits/{id}": {
      get: { summary: "Get visit detail", tags: ["Visits"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Visit with items, payments, and treatments" } } },
      patch: { summary: "Update visit", tags: ["Visits"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Updated visit" } } },
    },
    "/visits/{id}/items": {
      get: { summary: "List visit items", tags: ["Visits"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Visit items" } } },
      post: { summary: "Add item to visit", tags: ["Visits"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["itemName","unitPrice"], properties: { itemName: { type: "string" }, category: { type: "string" }, quantity: { type: "integer" }, unitPrice: { type: "number" } } } } } }, responses: { 201: { description: "Item added" } } },
    },
    "/visits/{id}/payments": {
      post: { summary: "Record a payment", tags: ["Visits"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["amount","paymentMethod"], properties: { amount: { type: "number" }, paymentMethod: { type: "string", enum: ["CASH","UPI","CARD","CHEQUE","NEFT","RTGS","OTHER"] }, referenceNumber: { type: "string" }, notes: { type: "string" } } } } } }, responses: { 201: { description: "Payment recorded" } } },
    },
    "/visits/{id}/print": {
      get: { summary: "Get visit print data (receipt)", tags: ["Visits"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Print data for receipt generation" } } },
    },
    "/appointments": {
      get: {
        summary: "List appointments",
        tags: ["Appointments"],
        parameters: [
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate",   in: "query", schema: { type: "string", format: "date" } },
          { name: "doctorId",  in: "query", schema: { type: "string" } },
          { name: "status",    in: "query", schema: { type: "string" } },
          { name: "limit",     in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: { 200: { description: "Appointment list", content: { "application/json": { schema: { type: "object", properties: { appointments: { type: "array", items: { $ref: "#/components/schemas/Appointment" } } } } } } } },
      },
      post: {
        summary: "Create appointment",
        tags: ["Appointments"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["patientId","doctorId","appointmentDate","appointmentTime"], properties: { patientId: { type: "string" }, doctorId: { type: "string" }, appointmentDate: { type: "string", format: "date" }, appointmentTime: { type: "string" }, durationMinutes: { type: "integer" }, type: { type: "string" }, notes: { type: "string" } } } } } },
        responses: { 201: { description: "Appointment created", content: { "application/json": { schema: { type: "object", properties: { appointment: { $ref: "#/components/schemas/Appointment" } } } } } } },
      },
    },
    "/appointments/{id}/status": {
      patch: { summary: "Update appointment status", tags: ["Appointments"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["SCHEDULED","IN_PROGRESS","COMPLETED","CANCELLED","NO_SHOW"] } } } } } }, responses: { 200: { description: "Status updated" } } },
    },
    "/appointments/bulk-status": {
      post: { summary: "Bulk update appointment status (max 50)", tags: ["Appointments"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["ids","status"], properties: { ids: { type: "array", items: { type: "string" }, maxItems: 50 }, status: { type: "string", enum: ["COMPLETED","NO_SHOW"] } } } } } }, responses: { 200: { description: "Bulk update result", content: { "application/json": { schema: { type: "object", properties: { updated: { type: "integer" } } } } } } } },
    },
    "/treatments": {
      get: { summary: "List treatment plans", tags: ["Treatments"], parameters: [{ name: "patientId", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string" } }], responses: { 200: { description: "Treatment list" } } },
      post: { summary: "Create treatment plan", tags: ["Treatments"], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Treatment created" } } },
    },
    "/reports": {
      get: {
        summary: "Get business reports",
        tags: ["Reports"],
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["7d","30d","90d","365d"], default: "30d" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Custom range start (use with 'to')" },
          { name: "to",   in: "query", schema: { type: "string", format: "date" }, description: "Custom range end (inclusive)" },
        ],
        responses: { 200: { description: "Report data including revenue, patient counts, and outstanding balances" }, 403: { description: "Requires REPORTS_VIEW permission" } },
      },
    },
    "/recalls": {
      get: { summary: "List recall visits", tags: ["Recalls"], parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["all","unscheduled","scheduled","fulfilled","lapsed"] } }], responses: { 200: { description: "Recall list" } } },
    },
    "/org/profile": {
      get: { summary: "Get organisation profile", tags: ["Organisation"], responses: { 200: { description: "Org profile" } } },
      patch: { summary: "Update organisation profile", tags: ["Organisation"], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Updated org" } } },
    },
    "/org/members": {
      get: { summary: "List staff members", tags: ["Organisation"], responses: { 200: { description: "Member list" } } },
    },
    "/export": {
      get: { summary: "Export data as CSV", tags: ["Export"], parameters: [{ name: "type", in: "query", required: true, schema: { type: "string", enum: ["patients","visits","treatments"] } }], responses: { 200: { description: "CSV file download", content: { "text/csv": {} } } } },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
