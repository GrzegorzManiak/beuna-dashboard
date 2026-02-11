import { QueryClient } from "@tanstack/react-query";

function createQueryClient( ){
    return new QueryClient({
        defaultOptions: {
            queries: { retry: 2 },
            mutations: { retry: 2 },
        },
    });
}

const QUERY_CLIENT = createQueryClient();

export {
    createQueryClient,
    QUERY_CLIENT,
};
