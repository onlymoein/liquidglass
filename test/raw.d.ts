declare module "*.yml?raw" {
  const text: string;
  export default text;
}

declare module "*.json?raw" {
  const text: string;
  export default text;
}
