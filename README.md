# Azure Cloud E-Library Prototype

This is a cloud-native e-library and inventory management system prototype designed for Microsoft Azure. It simulates a full cloud architecture using a local full-stack environment (React + Node.js + SQLite).

## System Architecture

The system follows a multi-tier architecture designed for Azure:

1.  **Presentation Layer (Frontend)**
    *   **Tech**: React, Tailwind CSS, Lucide Icons.
    *   **Azure Mapping**: Deployed to **Azure App Service** (Static Web Apps) or served via CDN.
    *   **Features**: Responsive UI, Book Search, Admin Dashboard.

2.  **Application Layer (Backend)**
    *   **Tech**: Node.js with Express.
    *   **Azure Mapping**: Deployed to **Azure App Service** (Web App for Containers).
    *   **Features**: RESTful API, Business Logic, JWT Authentication.

3.  **Data Layer**
    *   **Structured Data**: SQLite (Local) -> Maps to **Azure SQL Database**.
    *   **File Storage**: Local Filesystem -> Maps to **Azure Blob Storage**.

4.  **Identity Layer**
    *   **Tech**: JWT + Bcrypt (Local) -> Maps to **Azure Active Directory B2C**.

## Features

*   **User Portal**: Browse books, search by title/author, filter by category, view details.
*   **Admin Dashboard**: Manage inventory (Add/Edit/Delete books), view system statistics.
*   **Authentication**: Secure login for Admins and Users.
*   **Mock Data**: Automatically seeds 50+ books and categories on startup.

## Getting Started

1.  **Install Dependencies**: `npm install`
2.  **Run Development Server**: `npm run dev`
3.  **Access App**: Open the provided URL.

### Demo Credentials

*   **Admin**: `admin@library.com` / `admin123`
*   **User**: `user@library.com` / `user123`

## Azure Deployment Configuration (Simulated)

To migrate this prototype to Azure, follow these steps:

### 1. Azure SQL Database
*   Provision an Azure SQL Database.
*   Update `server.ts` to use `mssql` or `sequelize` with the Azure SQL connection string.
*   Run the schema migration scripts.

### 2. Azure Blob Storage
*   Create a Storage Account and a Blob Container (e.g., `book-covers`).
*   Update the file upload logic in `server.ts` to use `@azure/storage-blob` SDK.

### 3. Azure App Service
*   Dockerize the application (Dockerfile provided below).
*   Push the image to Azure Container Registry (ACR).
*   Deploy to Azure App Service for Containers.

### 4. Azure AD B2C
*   Register an application in Azure AD B2C.
*   Replace the local JWT logic with `passport-azure-ad` or MSAL.js.

## Testing Procedures

### Functional Testing
1.  **Login**: Test with admin and user credentials.
2.  **Search**: Try searching for "Technology" or specific authors.
3.  **Inventory**: Log in as Admin, add a new book, and verify it appears in the library.
4.  **Delete**: Remove a book and verify it is gone.

### API Testing
*   `GET /api/books`: List all books.
*   `POST /api/auth/login`: Authenticate user.
*   `GET /api/stats`: Get system stats (Admin only).

## Mock Data Generation
The system includes a seeding script in `server.ts` that generates:
*   5 Categories
*   50 Mock Books with random titles, authors, and ISBNs.
*   2 Default Users (Admin/User).
