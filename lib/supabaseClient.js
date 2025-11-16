// Cliente de Supabase para uso en el navegador
import { createClient } from "@supabase/supabase-js";

let _client = null;
export function getSupabase() {
	if (_client) return _client;
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseAnonKey) {
		if (typeof window !== "undefined") {
			console.warn("Supabase env faltantes:", {
				NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
				NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey,
			});
		}
		return null; // Evita fallo y permite mensaje claro en UI
	}
	_client = createClient(supabaseUrl.replace(/['"]/g, ""), supabaseAnonKey.replace(/['"]/g, ""));
	return _client;
}
