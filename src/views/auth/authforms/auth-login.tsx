






import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router";
import React, { useState } from "react";
import { toast } from "sonner";
import SocialButtons from "./social-buttons";
import logodark from "@/assets/images/logos/logoicon-dark.svg"
import logoicon from "@/assets/images/logos/logoicon.svg"
import {
  OpenPlatformApiError,
  useOpenPlatform,
} from "@/context/open-platform-context";
import {
  REST_SUCCESS_CODE,
  type LoginRequest,
  type RestResult,
  type TokenResponse,
} from "@/types/apps/open-platform";


const AuthLogin = () => {
  const router = useNavigate();
  const { setSession } = useOpenPlatform();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const identifier = (
      form.elements.namedItem("identifier") as HTMLInputElement
    ).value.trim();
    const password = (
      form.elements.namedItem("password") as HTMLInputElement
    ).value;

    if (!identifier || !password) {
      toast.error("请填写账号和密码");
      return;
    }

    setSubmitting(true);
    try {
      const body: LoginRequest = {
        identifier,
        password,
        clientType: "CONSOLE",
      };
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as RestResult<TokenResponse>;
      if (json.code !== REST_SUCCESS_CODE) {
        throw new OpenPlatformApiError(json.code, json.message);
      }
      setSession(json.data);
      toast.success("登录成功");
      router("/projects");
    } catch (err) {
      const e2 = err as OpenPlatformApiError;
      toast.error(e2.message || "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (

    <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12">
      <div className="w-full max-w-md flex flex-col gap-6 items-center">
        {/* Logo Header */}
        <a href="/">
          <img
            src={logodark}
            alt="Logo"
            width={40}
            height={40}
            className="dark:hidden block"
          />
          <img
            src={logoicon}
            alt="Logo"
            width={40}
            height={40}
            className="dark:block hidden"
          />
        </a>

        <div className="text-center flex flex-col gap-1">
          <p className="text-2xl font-medium text-foreground">
            Welcome to ShadcnDashboard
          </p>
          <p className="text-sm font-normal text-muted-foreground">
            Login to your account now
          </p>
        </div>

        {/* Social Buttons */}
        <SocialButtons />



        {/* Email/Password Form */}
        <form className="space-y-6 w-full" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="identifier"
                className="text-sm font-normal text-muted-foreground"
              >
                用户名 / 邮箱 / 手机号*
              </Label>
              <Input
                id="identifier"
                name="identifier"
                type="text"
                placeholder="demo 或 demo@example.com"
                required
                defaultValue="demo"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-sm font-normal text-muted-foreground"
              >
                密码*
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password123!"
                required
                defaultValue="Password123!"
              />
            </div>
            <div className="flex items-center justify-between text-sm flex-wrap gap-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="remember"
                  className={"cursor-pointer"}
                />
                <Label
                  htmlFor="remember"
                  className="text-muted-foreground font-normal cursor-pointer leading-0"
                >
                  Remember this device
                </Label>
              </div>
              <a
                href="/auth/auth2/forgot-password"
                className=" text-sm font-medium hover:underline underline-offset-4 transition-all"
              >
                Forgot Password?
              </a>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full rounded-lg"
            disabled={submitting}
          >
            {submitting ? "登录中…" : "登录"}
          </Button>
          <p className="text-center text-sm font-normal text-muted-foreground">
            Don&apos;t have an account?{" "}
            <a
              href="/auth/auth2/register"
              className="text-foreground font-medium hover:underline underline-offset-4 transition-all"
            >
              Create an account
            </a>
          </p>
        </form>
      </div>
    </div>

  );
};

export default AuthLogin;
