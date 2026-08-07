const categories = ['All', 'Starters', 'Main Course', 'Beverages', 'Desserts'];

const menuItems = [
    {
        id: 1,
        name: 'Spring Rolls',
        desc: 'Crispy veg rolls',
        price: 149,
        category: 'Starters',
        emoji: '🌯'
    },
    {
        id: 2,
        name: 'Garlic Bread',
        desc: 'Toasted herb butter',
        price: 99,
        category: 'Starters',
        emoji: '🍞'
    },
    {
        id: 3,
        name: 'Butter Chicken',
        desc: 'Creamy tomato gravy',
        price: 349,
        category: 'Main Course',
        emoji: '🍗'
    },
    {
        id: 4,
        name: 'Paneer Tikka',
        desc: 'Grilled cottage cheese',
        price: 299,
        category: 'Main Course',
        emoji: '🧀'
    },
    {
        id: 5,
        name: 'Fresh Lime Soda',
        desc: 'Tangy & refreshing',
        price: 89,
        category: 'Beverages',
        emoji: '🍋'
    },
    {
        id: 6,
        name: 'Mango Lassi',
        desc: 'Sweet yogurt smoothie',
        price: 119,
        category: 'Beverages',
        emoji: '🥭'
    },
    {
        id: 7,
        name: 'Gulab Jamun',
        desc: 'Soft milk dumplings',
        price: 79,
        category: 'Desserts',
        emoji: '🍡'
    },
    {
        id: 8,
        name: 'Brownie',
        desc: 'Warm with ice cream',
        price: 149,
        category: 'Desserts',
        emoji: '🍫'
    },
    {
        id: 9,
        name: 'Chicken Wings',
        desc: 'Spicy BBQ wings',
        price: 249,
        category: 'Starters',
        emoji: '🍗'
    },
    {
        id: 10,
        name: 'French Fries',
        desc: 'Crispy salted fries',
        price: 119,
        category: 'Starters',
        emoji: '🍟'
    },
    {
        id: 11,
        name: 'Chicken Biryani',
        desc: 'Aromatic basmati rice with chicken',
        price: 329,
        category: 'Main Course',
        emoji: '🍲'
    },
    {
        id: 12,
        name: 'Dal Makhani',
        desc: 'Slow cooked black lentils',
        price: 219,
        category: 'Main Course',
        emoji: '🥣'
    },
    {
        id: 13,
        name: 'Masala Chai',
        desc: 'Spiced milk tea',
        price: 49,
        category: 'Beverages',
        emoji: '☕'
    },
    {
        id: 14,
        name: 'Iced Coffee',
        desc: 'Chilled brew with milk',
        price: 129,
        category: 'Beverages',
        emoji: '🥤'
    },
    {
        id: 15,
        name: 'Rasmalai',
        desc: 'Sweet cottage cheese discs',
        price: 99,
        category: 'Desserts',
        emoji: '🥛'
    },
    {
        id: 16,
        name: 'Ice Cream Sundae',
        desc: 'Vanilla with chocolate sauce',
        price: 139,
        category: 'Desserts',
        emoji: '🍨'
    }
];


function getLocalImagePath(item) {
    const imageMap = {
        'Spring Rolls': 'spring-rolls.jpg',
        'Garlic Bread': 'garlic-bread.jpg',
        'Butter Chicken': 'butter-chicken.jpg',
        'Paneer Tikka': 'paneer-tikka.jpg',
        'Fresh Lime Soda': 'fresh-lime-soda.jpg',
        'Mango Lassi': 'mango-lassi.jpg',
        'Gulab Jamun': 'gulab-jamun.jpg',
        'Brownie': 'brownie.jpg',
        'Chicken Wings': 'chicken-wings.jpg',
        'French Fries': 'french-fries.jpg',
        'Chicken Biryani': 'chicken-biryani.jpg',
        'Dal Makhani': 'dal-makhani.jpg',
        'Masala Chai': 'masala-chai.jpg',
        'Iced Coffee': 'iced-coffee.jpg',
        'Rasmalai': 'rasmalai.jpg',
        'Ice Cream Sundae': 'ice-cream-sundae.jpg'
    };
    const fileName = imageMap[item.name];
    return fileName ? `assets/images/${fileName}` : getDishFallbackImage(item.name);
}

function getDishFallbackImage(dishName) {
    const unsplashMap = {
        'Spring Rolls': 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=500&auto=format&fit=crop&q=80',
        'Garlic Bread': 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=500&auto=format&fit=crop&q=80',
        'Butter Chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=80',
        'Paneer Tikka': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500&auto=format&fit=crop&q=80',
        'Fresh Lime Soda': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80',
        'Mango Lassi': 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=80',
        'Gulab Jamun': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80',
        'Brownie': 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=500&auto=format&fit=crop&q=80',
        'Chicken Wings': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&auto=format&fit=crop&q=80',
        'French Fries': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=500&auto=format&fit=crop&q=80',
        'Chicken Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80',
        'Dal Makhani': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
        'Masala Chai': 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=500&auto=format&fit=crop&q=80',
        'Iced Coffee': 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80',
        'Rasmalai': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&auto=format&fit=crop&q=80',
        'Ice Cream Sundae': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&auto=format&fit=crop&q=80'
    };
    return unsplashMap[dishName] || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&auto=format&fit=crop&q=80';
}

function getCategoryImage(cat) {
    const localMap = {
        'All': 'category-all.jpg',
        'Starters': 'category-starters.jpg',
        'Main Course': 'category-main-course.jpg',
        'Beverages': 'category-beverages.jpg',
        'Desserts': 'category-desserts.jpg'
    };
    return `assets/images/${localMap[cat] || 'default-category.jpg'}`;
}

function getCategoryFallbackImage(cat) {
    const unsplashMap = {
        'All': 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=120&auto=format&fit=crop&q=80',
        'Starters': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=120&auto=format&fit=crop&q=80',
        'Main Course': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=120&auto=format&fit=crop&q=80',
        'Beverages': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=120&auto=format&fit=crop&q=80',
        'Desserts': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=120&auto=format&fit=crop&q=80'
    };
    return unsplashMap[cat] || 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=120&auto=format&fit=crop&q=80';
}


