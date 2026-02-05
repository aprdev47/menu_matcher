# Menu Matcher UI

A React TypeScript application for matching menu items between a source menu and a target menu.

## Features

- **Two-Panel Layout**: Source menu on the left, target menu on the right
- **Auto-Matching**: Automatically matches items with identical names (100% confidence)
- **Smart Suggestions**: Uses Levenshtein distance algorithm to suggest potential matches with confidence scores
- **Manual Matching**: Click suggestions or select items from both panels to manually match
- **Create Missing Items**: Create button for items that don't exist in the target menu
- **Category Organization**: Items organized by categories
- **Match Status**:
  - Unmatched items displayed at the top with red background
  - Matched items displayed below with green indicators
- **Confidence Scoring**: Color-coded confidence scores (green 80%+, yellow 60-79%, orange below 60%)

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS

## Getting Started

Install dependencies:
```bash
npm install
```

Run the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

## How It Works

1. **Auto-Matching**: On load, the app automatically matches items with 100% name similarity
2. **Suggestions**: For unmatched items, the app shows up to 3 suggestions with confidence scores
3. **Manual Match**: Click "Match" button on a suggestion or select items from both panels
4. **Create New**: Click "Create" button to add missing items to the target menu

## Sample Data

The app includes sample restaurant menu data with:
- Appetizers (Chicken Wings, Mozzarella Sticks, Caesar Salad, French Fries)
- Main Course (Grilled Salmon, Beef Burger, Margherita Pizza, Chicken Pasta, Vegetable Stir Fry)
- Desserts (Chocolate Cake, Ice Cream Sundae, Apple Pie)

## Customization

To use your own menu data, modify the `initialSourceMenu` and `initialTargetMenu` in `src/App.tsx`.
