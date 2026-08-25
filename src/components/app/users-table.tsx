"use client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  status: string;
  lastSignInAt: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  LOCKED: "secondary",
  DISABLED: "destructive",
};

export function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last sign-in</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-mono text-xs">{u.email}</TableCell>
              <TableCell>{u.name ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[u.status] ?? "outline"}>{u.status}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
