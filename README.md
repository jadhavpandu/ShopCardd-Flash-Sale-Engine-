ShopCardd Flash-Sale Engine 
A high-performance, geolocation-aware flash sale system built with Node.js, Express, MongoDB, and Redis.


📁 Project Structure

shopcardd-flash-sale/
#├── config/
#│   ├── database.js          # MongoDB connection
#│   └── redis.js             # Redis client with error handling
#├── middleware/
#│   └── validators.js        # Input validation rules
#├── models/
#│   ├── Deal.js              # Deal schema with geospatial index
#│   └── Claim.js             # Claim schema with voucher generation
#├── .env.example             # Environment template
#├── .gitignore              
#├── package.json            
#├── server.js                # Application entry point
#└── README.md                # This file