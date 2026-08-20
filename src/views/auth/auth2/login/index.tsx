import { Card } from "@/components/ui/card";
import { Link, useNavigate } from "react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import SocialButtons from "../../authforms/social-buttons";
import { useState } from "react";
import { toast } from "sonner";
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

const BoxedLogin = () => {
  const navigate = useNavigate();
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
      navigate("/projects");
    } catch (err) {
      const e2 = err as OpenPlatformApiError;
      toast.error(e2.message || "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-accent  px-4">
        <Card className="w-full max-w-md border-none shadow-lg p-6">
          <div className="mx-auto  w-fit">
            <FullLogo />
          </div>

          <SocialButtons />
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
                  placeholder="demo"
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
                  <Checkbox id="remember" className={"cursor-pointer"} />
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
              <Link
                to="/auth/auth2/register"
                className="text-foreground font-medium hover:underline underline-offset-4 transition-all"
              >
                Create an account
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </>
  );
};

export default BoxedLogin;
