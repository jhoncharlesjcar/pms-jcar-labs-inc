/**
 * Utilidades para interceptar y mockear las llamadas a Supabase durante las pruebas E2E.
 *
 * Estrategia:
 * - Las peticiones REST de Supabase van a /rest/v1/<table>.
 * - Las peticiones de Auth van a /auth/v1/.
 * - Las RPCs van a /rest/v1/rpc/<function_name>.
 *
 * Interceptamos con page.route() y devolvemos datos mock.
 *
 * NOTA: El estado de localStorage (sesion de Supabase) se configura mediante
 * page.addInitScript en auth.setup.ts. Este modulo solo se encarga de
 * interceptar las peticiones de red.
 */

import { Page, Route } from '@playwright/test';
import {
  mockHotel,
  mockUser,
  mockRooms,
  mockReservas,
  mockVentasHotel,
  mockVentasPOS,
  mockCategoriasProductos,
  mockProductos,
  mockEgresos,
  mockCierresCaja,
  mockTarifasDinamicas,
  mockDashboardStats,
  mockAuthSession,
} from './test-data';

type EntityMap = Record<string, Record<string, any[]>>;

const entityData: EntityMap = {
  hoteles: [mockHotel],
  usuarios: [mockUser],
  habitaciones: mockRooms,
  reservas: mockReservas,
  ventas: mockVentasHotel,
  ventas_pos: mockVentasPOS,
  categorias_productos: mockCategoriasProductos,
  productos: mockProductos,
  egresos: mockEgresos,
  cierres_caja: mockCierresCaja,
  tarifas_dinamicas: mockTarifasDinamicas,
};

const rpcHandlers: Record<string, any> = {
  get_dashboard_stats: mockDashboardStats,
};

/**
 * Configura el mocking de red para todas las APIs de Supabase.
 */
export async function setupSupabaseMocks(page: Page) {
  await page.route('https://nwprnycqplnmztpjicea.supabase.co/**', async (route: Route, request) => {
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.includes('/auth/v1/')) {
      await handleAuthRequest(route, request, url);
      return;
    }

    if (path.includes('/rest/v1/rpc/')) {
      await handleRpcRequest(route, request, url);
      return;
    }

    if (path.includes('/rest/v1/')) {
      await handleRestRequest(route, request, url);
      return;
    }

    await route.continue();
  });
}

async function handleAuthRequest(route: Route, request: any, url: URL) {
  const path = url.pathname;

  if (path.includes('/auth/v1/user')) {
    const userData = {
      id: mockUser.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: mockUser.email,
      email_confirmed_at: '2025-01-01T00:00:00Z',
      phone: '',
      last_sign_in_at: '2026-07-14T00:00:00Z',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: mockUser.full_name },
      identities: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2026-07-14T00:00:00Z',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userData),
    });
    return;
  }

  if (path.includes('/auth/v1/session') || path.includes('/auth/v1/token')) {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAuthSession),
      });
      return;
    }
  }

  if (path.includes('/auth/v1/logout')) {
    await route.fulfill({ status: 204, body: '' });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({}),
  });
}

async function handleRpcRequest(route: Route, request: any, url: URL) {
  const rpcName = url.pathname.split('/').pop() || '';

  if (rpcHandlers[rpcName]) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rpcHandlers[rpcName]),
    });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(null),
  });
}

async function handleRestRequest(route: Route, request: any, url: URL) {
  const pathParts = url.pathname.split('/');
  const tableIndex = pathParts.indexOf('v1') + 1;
  const tableName = pathParts[tableIndex];

  if (!tableName || !entityData[tableName]) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    return;
  }

  let data = [...entityData[tableName]];

  // Aplicar filtros desde query params (formato Supabase: ?columna=eq.valor)
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset') {
      continue;
    }

    const valParts = value.split('.');
    if (valParts.length >= 2 && ['eq', 'in', 'gte', 'lte', 'neq', 'gt', 'lt', 'like'].includes(valParts[0])) {
      const operator = valParts[0];
      const filterValue = valParts.slice(1).join('.');

      if (operator === 'eq') {
        data = data.filter((item: any) => String(item[key]) === filterValue);
      } else if (operator === 'neq') {
        data = data.filter((item: any) => String(item[key]) !== filterValue);
      } else if (operator === 'in') {
        const values = filterValue.split(',');
        data = data.filter((item: any) => values.includes(String(item[key])));
      } else if (operator === 'gte') {
        data = data.filter((item: any) => String(item[key]) >= filterValue);
      } else if (operator === 'lte') {
        data = data.filter((item: any) => String(item[key]) <= filterValue);
      } else if (operator === 'gt') {
        data = data.filter((item: any) => String(item[key]) > filterValue);
      } else if (operator === 'lt') {
        data = data.filter((item: any) => String(item[key]) < filterValue);
      }
    } else {
      data = data.filter((item: any) => String(item[key]) === value);
    }
  }

  if (tableName === 'hoteles' && data.length === 0) {
    data = [mockHotel];
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}
