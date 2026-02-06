type UsersQuery = {
    role?: "ADMIN" | "MANAGER" | "ACCOUNTANT";
};

type UserIdParams = {
    userId: string;
};

export {
    type UsersQuery,
    type UserIdParams,
}