import "server-only";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { waEnabled } from "../config";
import type { WaViewer } from "./data";

/** The signed-in viewer, or a 404 when the feature is switched off. */
export async function waViewer(): Promise<WaViewer> {
  if (!waEnabled()) notFound();
  const viewer = await getViewer();
  return { ...viewer, isRM: viewer.role === "regional_manager" };
}
