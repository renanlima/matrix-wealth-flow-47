// Upload helpers para Storage com validação de tamanho/tipo + signed URLs
import { supabase } from "@/integrations/supabase/client";

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_DOC_MIME = ["application/pdf", "image/jpeg", "image/png"];

export interface UploadOpts {
  bucket: string;
  /** primeiro segmento DEVE ser o uid do cliente para passar nas RLS de storage */
  pathPrefix: string; // ex: `${clientId}` ou `${clientId}/contracts`
  file: File;
}

export interface UploadResult {
  path: string;
  size: number;
  mime: string;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return "Arquivo excede 5MB.";
  if (!ALLOWED_DOC_MIME.includes(file.type)) return "Tipo inválido. Use PDF, JPG ou PNG.";
  return null;
}

export async function uploadFile({ bucket, pathPrefix, file }: UploadOpts): Promise<UploadResult> {
  const err = validateFile(file);
  if (err) throw new Error(err);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${pathPrefix}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return { path, size: file.size, mime: file.type };
}

export async function getSignedUrl(bucket: string, path: string, ttl = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeFile(bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
