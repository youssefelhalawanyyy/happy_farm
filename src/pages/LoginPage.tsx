import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuth } from "@/context/AuthContext";
import { Mazra3tyLogo } from "@/components/brand/Mazra3tyLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const LoginPage = () => {
  const { user, profile, login, bootstrapAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [adminName, setAdminName] = useState("Mazra3ty Administrator");

  if (user && profile) {
    return <Navigate to="/" replace />;
  }

  const submitLogin = async (): Promise<void> => {
    try {
      setLoading(true);
      await login(email, password);
      toast.success("Welcome back to Mazra3ty");
    } catch (error) {
      console.error(error);
      toast.error("Unable to sign in. Verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  const createFirstAdmin = async (): Promise<void> => {
    try {
      setLoading(true);
      await bootstrapAdmin(email, password, adminName);
      toast.success("Admin account created");
    } catch (error) {
      console.error(error);
      toast.error("Bootstrap failed. If account exists, login instead.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="mazra-hero-gradient relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.3),transparent_28%),radial-gradient(circle_at_10%_80%,rgba(255,255,255,0.15),transparent_40%)]" />
        <div className="relative z-10">
          <Mazra3tyLogo variant="primary" className="text-white [&_p:last-child]:text-white/90" />
        </div>

        <div className="relative z-10 space-y-4">
          <h1 className="max-w-lg text-4xl font-bold leading-tight">Smart Farms Start Here</h1>
          <p className="max-w-lg text-lg text-white/90">
            Manage your poultry farm with smart tools, real-time monitoring, and powerful analytics.
          </p>
          <div className="inline-flex rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur">
            Mazra3ty Dashboard
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border border-white/30 bg-white/15 p-4">🐔 Chicks</div>
          <div className="rounded-xl border border-white/30 bg-white/15 p-4">🌾 Feed</div>
          <div className="rounded-xl border border-white/30 bg-white/15 p-4">🌡 Sensors</div>
        </div>
      </section>

      <section className="grid place-items-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Mazra3tyLogo variant="horizontal" className="mb-2" />
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Lock size={18} />
              Login
            </CardTitle>
            <CardDescription>Secure access to your poultry operations center.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="admin@mazra3ty.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {showBootstrap ? (
              <div className="space-y-2">
                <Label>Admin Display Name</Label>
                <Input value={adminName} onChange={(event) => setAdminName(event.target.value)} />
              </div>
            ) : null}

            <Button disabled={loading || !email || !password} className="w-full" onClick={() => void submitLogin()}>
              Login
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              disabled={loading || !email || !password}
              onClick={() => {
                if (!showBootstrap) {
                  setShowBootstrap(true);
                  return;
                }
                void createFirstAdmin();
              }}
            >
              <ShieldCheck size={14} className="mr-2" />
              {showBootstrap ? "Create First Admin" : "Bootstrap First Admin"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
