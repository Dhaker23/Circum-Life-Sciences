"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const SPEC_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = { DRAFT: "outline", APPROVED: "secondary", EFFECTIVE: "default", SUPERSEDED: "secondary" };
export default function SpecificationsPage() {
  const t = useTranslations("lab");
  const { data, isLoading } = useQuery({ queryKey: ["specifications"], queryFn: async () => { const res = await fetch("/api/lab/specifications?pageSize=100", { credentials: "same-origin" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return json.data as Array<{ id: string; code: string; name: string; parameter: string; criterionType: string; criterionValue: string; status: string }>; } });
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("specs.title")}</h1><p className="text-sm text-muted-foreground">{t("specs.subtitle")}</p></div><Card><CardHeader><CardTitle className="text-base">{t("specs.title")}</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data && data.length > 0 ? (<div className="max-h-[32rem] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>{t("specs.code")}</TableHead><TableHead>{t("specs.parameter")}</TableHead><TableHead>{t("specs.criterion")}</TableHead><TableHead>{t("common.status")}</TableHead></TableRow></TableHeader><TableBody>{data.map((s) => (<TableRow key={s.id}><TableCell className="font-mono text-xs">{s.code}</TableCell><TableCell className="text-xs">{s.parameter}</TableCell><TableCell className="text-xs font-mono">{s.criterionType}: {s.criterionValue}</TableCell><TableCell><Badge variant={SPEC_VARIANT[s.status] ?? "outline"}>{s.status}</Badge></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-sm text-muted-foreground">{t("specs.noData")}</p>}</CardContent></Card></div>);
}
