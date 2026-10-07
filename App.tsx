import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { routers } from "./router";
import { AuthProvider } from "./hooks/use-auth";
import { ResetPassword } from "./components/auth/reset-password";
import { bootstrapTheme } from "./lib/theme";

bootstrapTheme();

const queryClient = new QueryClient();

const App = () => {
  const router = createHashRouter(routers);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ResetPassword />
          <RouterProvider router={router} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
