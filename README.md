# Punjab Exotic Foods Ltd - Wholesale Management Portal

A clean, professional wholesale management portal built with React + TypeScript + Vite, ready for Supabase integration.

## ?? Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Authentication

Accounts are managed in the connected Supabase project. This repository does
not ship demo or fallback credentials.

## ?? Features

### Admin Portal
- **Dashboard** - Overview metrics, recent orders, and customer activity
- **Customers** - Full CRUD operations with search and filtering
- **Products** - Product catalog management
- **Stock** - Inventory tracking with availability status
- **Orders** - Order management with status updates
- **Invoices** - Invoice register and tracking
- **Payments** - Payment history and tracking
- **Delivery Areas** - Delivery zone pricing management
- **Tickets** - Internal support ticket system
- **Complaints** - Complaints tracking
- **Admins** - Staff account management with granular permissions
- **Settings** - Portal configuration

### Customer Portal
- **Dashboard** - Overview of available products and orders
- **Products & Prices** - Browse product catalog
- **Place Order** - Simple order creation
- **My Orders** - Order history and tracking
- **Invoices & Payments** - View invoices and payment records
- **Support Tickets** - Submit and track support requests

## ??? Architecture

### Frontend-First Design
- Built without backend dependencies initially
- Mock services simulate database operations
- Ready for Supabase integration via clean API layer

### Project Structure
```
src/
+-- api/              # API wrappers (swap point for Supabase)
+-- components/       # Reusable UI components
|   +-- layout/      # AppLayout, Sidebar, Topbar
|   +-- ui/          # Button, Card, Input, Modal, Table
+-- data/            # Mock seed data
+-- pages/           # Route pages
|   +-- admin/       # Admin portal modules
|   +-- customer/    # Customer portal modules
+-- services/        # Mock auth and database services
+-- types/           # TypeScript domain models
+-- App.tsx          # Application root
+-- main.tsx         # Entry point
```

### Type-Safe Data Models
- `User`, `Customer`, `Product`, `StockItem`
- `Order`, `Invoice`, `Payment`
- `SupportTicket`, `ActivityLog`, `DeliveryArea`
- `AdminStaff` with `PermissionSet`

## ?? Supabase Migration Path

### 1. Replace Auth Service
```typescript
// src/services/authService.ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)
// Replace mockAuthService methods with supabase.auth calls
```

### 2. Replace Database Service
```typescript
// src/services/databaseService.ts
// Replace in-memory arrays with supabase.from('table').select()
```

### 3. API Layer Stays Same
The `src/api/` modules already provide the swap boundary; pages call these, not services directly.

## ?? Styling

- **Color Scheme:** Professional green/white business theme
- **Layout:** Sidebar navigation with topbar
- **Forms:** Clean grid-based layouts with validation-ready inputs
- **Tables:** Sortable, searchable data grids
- **Responsive:** Mobile-friendly design

## ??? Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS** - Custom professional styling (no framework dependencies)

## ?? Development Notes

- All mock data is in `src/data/mockData.ts`
- Services maintain in-memory state during session
- Forms include basic validation patterns
- Build passes strict TypeScript checks
- No runtime dependencies on external APIs

## ?? Next Steps

1. **Set up Supabase project**
2. **Create database schema** matching type definitions
3. **Replace mock services** with Supabase client calls
4. **Add Row Level Security (RLS)** policies
5. **Deploy frontend** to Vercel/Netlify
6. **Configure Supabase Auth** providers

---

**Built for:** Punjab Exotic Foods Ltd  
**Status:** ? Frontend complete and Supabase-ready  
**Build:** Production-ready (222KB gzipped)
