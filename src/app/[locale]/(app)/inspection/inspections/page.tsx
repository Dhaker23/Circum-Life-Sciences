"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const INSP_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = { PENDING: "outline", PASSED: "default", FAILED: "destructive", CONDITIONAL: "secondary" };
export default function InspectionsPage() {
  const t = useTranslations("inspection");
  const { data, isLoading } = useQuery({ queryKey: ["inspections"], queryFn: async () => { const res = await fetch("/api/inspection/inspections?pageSize=100", { credentials: "same-origin" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return json.data as Array<{ id: string; code: string; inspectionType: string; status: string; evaluatedResult: string | null; sourceEntityType: string }>; } });
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("subtitle")}</p></div><Card><CardHeader><CardTitle className="text-base">{t("title")}</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data && data.length > 0 ? (<div className="max-h-[32rem] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>{t("code")}</TableHead><TableHead>{t("type")}</TableHead><TableHead>{t("source")}</TableHead><TableHead>{t("evaluated")}</TableHead><TableHead>{t("common.status")}</TableHead></TableRow></TableHeader><TableBody>{data.map((i) => (<TableRow key={i.id}><TableCell className="font-mono text-xs">{i.code}</TableCell><TableCell className="text-xs">{i.inspectionType}</TableCell><TableCell className="text-xs font-mono">{i.sourceEntityType}</TableCell><TableCell>{i.evaluatedResult ? <Badge variant={INSP_VARIANT[i.evaluatedResult] ?? "outline"}>{i.evaluatedResult}</Badge> : "-"}</TableCell><TableCell><Badge variant={INSP_VARIANT[i.status] ?? "outline"}>{i.status}</Badge></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-sm text-muted-foreground">{t("noData")}</p>}</CardContent></Card></div>);
}
