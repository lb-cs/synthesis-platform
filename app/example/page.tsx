import Link from "next/link";

import { HealthCheck } from "@/components/health-check";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ExamplePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Example route</CardTitle>
          <CardDescription>
            A page under <code className="font-mono">app/example</code> using
            shadcn/ui components and calling a Route Handler.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HealthCheck />
        </CardContent>
      </Card>
      <Button variant="ghost" render={<Link href="/" />}>
        Back home
      </Button>
    </main>
  );
}
