export const useRouter       = jest.fn(() => ({ navigate: jest.fn(), push: jest.fn(), back: jest.fn(), replace: jest.fn() }));
export const useSegments     = jest.fn(() => [] as string[]);
export const useLocalSearchParams = () => ({});
export const Link            = ({ children }: any) => children;
export const Stack           = ({ children }: any) => children;
