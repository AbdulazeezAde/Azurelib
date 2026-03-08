# Azure Migration Guide

This guide outlines the steps to migrate the local prototype to a full Azure cloud deployment.

## 1. Database Migration (Azure SQL)

The current prototype uses SQLite. To migrate to Azure SQL Database:

1.  **Provision Azure SQL Database**:
    *   Create a new SQL Database resource in Azure Portal.
    *   Configure firewall rules to allow access from Azure App Service.

2.  **Update Backend Connection**:
    *   Install `mssql` driver: `npm install mssql`
    *   Replace `better-sqlite3` logic in `server.ts` with `mssql` connection pool.
    *   Example Connection:
        ```typescript
        const config = {
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          server: process.env.DB_SERVER,
          database: process.env.DB_NAME,
          options: { encrypt: true } // Required for Azure
        };
        ```

3.  **Schema Migration**:
    *   Run the SQL scripts in `server.ts` (adapted for T-SQL syntax) against the Azure SQL instance.

## 2. File Storage Migration (Azure Blob Storage)

The current prototype uses local disk storage. To migrate to Azure Blob Storage:

1.  **Provision Storage Account**:
    *   Create a Storage Account in Azure Portal.
    *   Create a container named `books` or `covers`.

2.  **Update Backend Logic**:
    *   Install SDK: `npm install @azure/storage-blob`
    *   Replace `multer` disk storage with memory storage.
    *   Upload buffer directly to Blob Storage.
    *   Generate SAS tokens or use public URLs for file access.

## 3. Authentication Migration (Azure AD B2C)

The current prototype uses local JWT. To migrate to Azure AD B2C:

1.  **Configure Azure AD B2C**:
    *   Create a B2C tenant.
    *   Register the application.
    *   Create User Flows (Sign up, Sign in).

2.  **Update Frontend**:
    *   Install MSAL React: `npm install @azure/msal-react @azure/msal-browser`
    *   Replace `Login` component with MSAL login redirect.

3.  **Update Backend**:
    *   Validate B2C tokens using `passport-azure-ad`.

## 4. Deployment (Azure App Service)

1.  **Containerize**:
    *   Build the Docker image using the provided `Dockerfile`.
    *   Push to Azure Container Registry (ACR).

2.  **Deploy**:
    *   Create an App Service Plan (Linux).
    *   Create a Web App for Containers.
    *   Configure it to pull the image from ACR.
    *   Set environment variables (`DB_SERVER`, `DB_USER`, etc.) in App Service configuration.
