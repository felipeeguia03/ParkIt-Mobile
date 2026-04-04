// Mock de @supabase/supabase-js para tests
export const createClient = jest.fn(() => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({ then: (cb: any) => cb({ data: [], error: null }) })),
    update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
    insert: jest.fn(() => Promise.resolve({ error: null })),
  })),
  channel: jest.fn(() => ({
    on: jest.fn(function (this: any) { return this; }),
    subscribe: jest.fn(() => ({})),
  })),
  removeChannel: jest.fn(),
}));
