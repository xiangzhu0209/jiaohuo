import { Navigate } from "react-router-dom";
import AppLayout from "./components/layout/app-layout";
import RequireAuth from "./components/auth/require-auth";
import Login from "./pages/Login";
import Orders from "./pages/Orders";
import OrderForm from "./pages/OrderForm";
import OrderPrint from "./pages/OrderPrint";
import BatchPrint from "./pages/BatchPrint";
import Reconciliation from "./pages/Reconciliation";
import Vendors from "./pages/Vendors";
import Prices from "./pages/Prices";
import Setup from "./pages/Setup";
import NotFound from "./pages/NotFound";

export const routers = [
  {
    path: "/",
    name: "home",
    element: <Navigate to="/orders" replace />,
  },
  {
    path: "/login",
    name: "login",
    element: <Login />,
  },
  {
    path: "/",
    name: "app",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: "orders", name: "orders", element: <Orders /> },
      { path: "orders/new", name: "order-new", element: <OrderForm /> },
      { path: "orders/:id/edit", name: "order-edit", element: <OrderForm /> },
      { path: "orders/:id/print", name: "order-print", element: <OrderPrint /> },
      { path: "orders/print", name: "order-batch-print", element: <BatchPrint /> },
      { path: "reconciliation", name: "reconciliation", element: <Reconciliation /> },
      { path: "vendors", name: "vendors", element: <Vendors /> },
      { path: "prices", name: "prices", element: <Prices /> },
      { path: "setup", name: "setup", element: <Setup /> },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
