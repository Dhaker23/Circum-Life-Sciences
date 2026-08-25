"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export default function TestMethodsPage() {
  const t = useTranslations("lab");
  const { data, isLoading } = useQuery({ queryKey: ["test-methods"], queryFn: async () => { const res = await fetch("/api/lab/test-methods?pageSize=100", { credentials: "same-origin" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return json.data as Array<{ id: string; code: string; name: string; status: string; _count?: { specs: number } }>; } });
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("methods.title")}</h1><p className="text-sm text-muted-foreground">{t("methods.subtitle")}</p></div><Card><CardHeader><CardTitle className="text-base">{t("methods.title")}</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data && data.length > 0 ? (<div className="max-h-[32rem] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>{t("methods.code")}</TableHead><TableHead>{t("methods.name")}</TableHead><TableHead>{t("common.status")}</TableHead></TableRow></TableHeader><TableBody>{data.map((m) => (<TableRow key={m.id}><TableCell className="font-mono text-xs">{m.code}</TableCell><TableCell className="text-xs">{m.name}</TableCell><TableCell><Badge variant={m.status === "EFFECTIVE" ? "default" : "secondary"}>{m.status}</Badge></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-sm text-muted-foreground">{t("methods.noData")}</p>}</CardContent></Card></div>);
}
