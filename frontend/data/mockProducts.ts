export interface Product {
  id: string;
  name: string;
  category: string;
  category_slug: string;
  price: number;
  rating: number;
  image: string;
  badge?: string;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Suport Controller RGB & Minimalist",
    category: "Standuri",
    category_slug: "standuri",
    price: 89.99,
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?auto=format&fit=crop&q=80&w=600", // Poză orientativă de print 3D / tech
    badge: "Best Seller",
  },
  {
    id: "2",
    name: "Stand Premium pentru Căști Over-Ear",
    category: "Standuri",
    category_slug: "standuri",
    price: 119.99,
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=600",
    badge: "Nou",
  },
  {
    id: "3",
    name: "Keychain Personalizat / Token",
    category: "Brelocuri",
    category_slug: "keychains",
    price: 34.99,
    rating: 5.0,
    image: "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?auto=format&fit=crop&q=80&w=600",
    badge: "Popular",
  },
  {
    id: "4",
    name: "Suport Multi-Dispozitive Desk Organizer",
    category: "Standuri",
    category_slug: "standuri",
    price: 149.99,
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=600",
  },
];