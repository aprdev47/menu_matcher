import { useState } from 'react';
import { MenuMatcher } from './components/MenuMatcher';
import type { MenuCategory } from './types';

// Sample data
const initialSourceMenu: MenuCategory[] = [
  {
    id: 'appetizers',
    name: 'Appetizers',
    items: [
      { id: 's1', name: 'Chicken Wings', description: 'Spicy buffalo wings', price: 12.99 },
      { id: 's2', name: 'Mozzarella Sticks', description: 'Breaded cheese sticks', price: 8.99 },
      { id: 's3', name: 'Caesar Salad', description: 'Fresh romaine lettuce', price: 9.99 },
      { id: 's4', name: 'French Fries', description: 'Crispy golden fries', price: 5.99 },
    ],
  },
  {
    id: 'entrees',
    name: 'Main Course',
    items: [
      { id: 's5', name: 'Grilled Salmon', description: 'Atlantic salmon with vegetables', price: 24.99 },
      { id: 's6', name: 'Beef Burger', description: 'Angus beef burger with cheese', price: 15.99 },
      { id: 's7', name: 'Margherita Pizza', description: 'Classic pizza with basil', price: 16.99 },
      { id: 's8', name: 'Chicken Pasta', description: 'Pasta with grilled chicken', price: 18.99 },
      { id: 's9', name: 'Vegetable Stir Fry', description: 'Mixed vegetables in sauce', price: 14.99 },
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    items: [
      { id: 's10', name: 'Chocolate Cake', description: 'Rich chocolate layer cake', price: 7.99 },
      { id: 's11', name: 'Ice Cream Sundae', description: 'Vanilla ice cream with toppings', price: 6.99 },
      { id: 's12', name: 'Apple Pie', description: 'Warm apple pie with cinnamon', price: 6.49 },
    ],
  },
];

const initialTargetMenu: MenuCategory[] = [
  {
    id: 'appetizers',
    name: 'Appetizers',
    items: [
      { id: 't1', name: 'Chicken Wings', description: 'Buffalo style wings', price: 12.99 },
      { id: 't2', name: 'Cheese Sticks', description: 'Fried mozzarella', price: 8.99 },
      { id: 't3', name: 'Caesar Side Salad', description: 'Romaine with caesar dressing', price: 9.99 },
      { id: 't4', name: 'Onion Rings', description: 'Crispy onion rings', price: 6.99 },
    ],
  },
  {
    id: 'entrees',
    name: 'Main Course',
    items: [
      { id: 't5', name: 'Grilled Salmon Fillet', description: 'Fresh salmon', price: 24.99 },
      { id: 't6', name: 'Classic Burger', description: 'Beef burger', price: 15.99 },
      { id: 't7', name: 'Spaghetti with Chicken', description: 'Italian pasta', price: 18.99 },
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    items: [
      { id: 't8', name: 'Chocolate Lava Cake', description: 'Molten chocolate cake', price: 7.99 },
      { id: 't9', name: 'Tiramisu', description: 'Italian coffee dessert', price: 8.99 },
    ],
  },
];

function App() {
  const [sourceMenu] = useState<MenuCategory[]>(initialSourceMenu);
  const [targetMenu, setTargetMenu] = useState<MenuCategory[]>(initialTargetMenu);

  const handleMatch = (sourceItemId: string, targetItemId: string | null, categoryId: string) => {
    console.log('Matched:', { sourceItemId, targetItemId, categoryId });
  };

  const handleCreate = (sourceItem: any, categoryId: string) => {
    console.log('Creating item:', sourceItem, 'in category:', categoryId);

    // Add the item to target menu
    setTargetMenu(prevMenu => {
      const updatedMenu = [...prevMenu];
      const categoryIndex = updatedMenu.findIndex(cat => cat.id === categoryId);

      if (categoryIndex === -1) {
        // Category doesn't exist, create it
        const sourceCategory = sourceMenu.find(cat => cat.id === categoryId);
        if (sourceCategory) {
          updatedMenu.push({
            id: categoryId,
            name: sourceCategory.name,
            items: [{ ...sourceItem, id: `created-${Date.now()}` }],
          });
        }
      } else {
        // Add to existing category
        updatedMenu[categoryIndex].items.push({
          ...sourceItem,
          id: `created-${Date.now()}`,
        });
      }

      return updatedMenu;
    });
  };

  const handleUnmatch = (sourceItemId: string, categoryId: string) => {
    console.log('Unmatched:', { sourceItemId, categoryId });
  };

  const handleDeleteItem = (targetItemId: string, categoryId: string) => {
    console.log('Deleting item:', { targetItemId, categoryId });

    // Remove the item from target menu
    setTargetMenu(prevMenu => {
      const updatedMenu = [...prevMenu];
      const categoryIndex = updatedMenu.findIndex(cat => cat.id === categoryId);

      if (categoryIndex !== -1) {
        updatedMenu[categoryIndex] = {
          ...updatedMenu[categoryIndex],
          items: updatedMenu[categoryIndex].items.filter(item => item.id !== targetItemId),
        };

        // Remove category if it's empty
        if (updatedMenu[categoryIndex].items.length === 0) {
          return updatedMenu.filter(cat => cat.id !== categoryId);
        }
      }

      return updatedMenu;
    });
  };

  return (
    <MenuMatcher
      sourceMenu={sourceMenu}
      targetMenu={targetMenu}
      onMatch={handleMatch}
      onCreate={handleCreate}
      onUnmatch={handleUnmatch}
      onDeleteItem={handleDeleteItem}
    />
  );
}

export default App;
