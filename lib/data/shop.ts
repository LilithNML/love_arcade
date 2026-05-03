export type ShopRequirement = {
  type: string;
  value: number;
  description: string;
};

export type ShopItem = {
  id: number;
  name: string;
  price: number;
  image: string;
  file: string;
  tags: string[];
  category?: string;
  requirements?: ShopRequirement;
};
