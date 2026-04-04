export const useRouter       = () => ({ navigate: jest.fn(), push: jest.fn(), back: jest.fn() });
export const useLocalSearchParams = () => ({});
export const Link            = ({ children }: any) => children;
