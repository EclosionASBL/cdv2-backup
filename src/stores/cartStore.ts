import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string; // sessionId-kidId
  activity_id: string;
  kid_id: string;
  kidName: string;
  activityName: string;
  activityCategory: string;
  dateRange: string;
  price_type: 'normal' | 'reduced' | 'local' | 'local_reduced';
  reduced_declaration: boolean;
  price: number;
  imageUrl?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
  updatePriceType: (type: 'normal' | 'reduced') => void;
  setReducedDeclaration: (value: boolean) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item) => set((state) => {
        // Validate required fields
        if (!item.activity_id) {
          console.error('Missing activity_id for item:', item);
          return state;
        }

        if (!item.kid_id) {
          console.error('Missing kid_id for item:', item);
          return state;
        }
        
        // Check if activity+kid combination already exists
        const exists = state.items.some(
          (i) => i.activity_id === item.activity_id && i.kid_id === item.kid_id
        );
        
        if (exists) {
          return state; // Don't add duplicate
        }
        
        return { items: [...state.items, item] };
      }),
      
      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id)
      })),
      
      clearCart: () => set({ items: [] }),
      
      total: () => {
        const items = get().items;
        return items.reduce((total, item) => total + item.price, 0);
      },
      
      itemCount: () => get().items.length,

      updatePriceType: (type) => set((state) => ({
        items: state.items.map(item => {
          // Get the base price and reduced price from the activity
          const activity = window.sessionStorage.getItem(`activity_${item.activity_id}`);
          let mainPrice = item.price;
          let reducedPrice = null;
          
          if (activity) {
            const activityData = JSON.parse(activity);
            mainPrice = activityData.calculated_main_price || activityData.prix_normal;
            reducedPrice = activityData.calculated_reduced_price || activityData.prix_reduit;
          }

          // Determine the new price type
          let newPriceType = item.price_type;
          if (type === 'normal') {
            newPriceType = item.price_type.includes('local') ? 'local' : 'normal';
          } else {
            newPriceType = item.price_type.includes('local') ? 'local_reduced' : 'reduced';
          }

          // Determine the new price based on the price type
          let newPrice = mainPrice;
          if (newPriceType === 'reduced' || newPriceType === 'local_reduced') {
            newPrice = reducedPrice || mainPrice;
          }

          return {
            ...item,
            price_type: newPriceType,
            price: newPrice
          };
        })
      })),

      setReducedDeclaration: (value) => set((state) => ({
        items: state.items.map(item => ({
          ...item,
          reduced_declaration: value
        }))
      }))
    }),
    {
      name: 'cart-storage',
    }
  )
);