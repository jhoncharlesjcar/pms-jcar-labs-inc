/**
 * Mapeo Amigable de Excepciones SQL/Supabase — Emil Kowalski Plan (Tarea 4.2)
 * Traduce códigos de error y respuestas de Supabase/PostgreSQL a descripciones comprensibles para el usuario.
 */

interface ErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

export function formatErrorMessage(err: ErrorLike | unknown, fallbackMessage = "Ocurrió un error inesperado. Intente nuevamente."): string {
  if (!err) return fallbackMessage;

  const errorObj = err as ErrorLike;
  const message = errorObj.message || "";
  const code = errorObj.code || "";

  // Violación de Row Level Security (RLS)
  if (message.includes("row-level security policy") || code === "42501") {
    return "Sesión expirada o permisos de usuario insuficientes para esta operación.";
  }

  // Clave duplicada (Unique Constraint)
  if (code === "23505" || message.includes("duplicate key value")) {
    return "Ya existe un registro con este identificador o código en el sistema.";
  }

  // Clave foránea no encontrada
  if (code === "23503" || message.includes("violates foreign key constraint")) {
    return "No se pudo completar la operación porque el registro asociado no existe o está vinculado a otros datos.";
  }

  // Credenciales inválidas
  if (message.includes("Invalid login credentials")) {
    return "Email o contraseña incorrectos. Por favor verifique sus datos.";
  }

  // Límite de conexiones o timeout
  if (message.includes("network") || message.includes("Failed to fetch") || message.includes("FetchError")) {
    return "Error de conexión a la red. Verifique su acceso a internet.";
  }

  return message || fallbackMessage;
}
