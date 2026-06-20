/* ============================================================
   AIRPORTS DATABASE
   ────────────────────────────────────────────────────────────
   Static curated dataset of major Indian domestic airports plus
   key international hubs, used by the flight-route engine for
   nearest-airport lookup, graph construction, and great-circle
   distance calculation.

   FIELDS:
     code      → IATA 3-letter airport code
     name      → Full airport name
     city      → City the airport serves (matched against user input)
     country   → Country name
     latitude  → Decimal degrees (WGS84)
     longitude → Decimal degrees (WGS84)
     isHub     → true if this airport is treated as a major hub
                 (used by airport-graph.js to decide which
                 airports get hub↔hub edges vs regional↔hub only)

   NOTE: This is a hand-curated reference dataset for trip-planning
   estimation purposes — not a live aviation database. Coordinates
   are airport reference points, not runway-precise. Extend this
   array to add more airports; no other file needs to change.
   ════════════════════════════════════════════════════════════
   */

var AIRPORTS = [

  /* ── INDIA: MAJOR HUBS (metro / high-traffic international) ── */
  { code: "DEL", name: "Indira Gandhi International Airport",                city: "New Delhi",   country: "India", latitude: 28.5562, longitude: 77.1000, isHub: true },
  { code: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport",  city: "Mumbai",      country: "India", latitude: 19.0896, longitude: 72.8656, isHub: true },
  { code: "BLR", name: "Kempegowda International Airport",                  city: "Bangalore",   country: "India", latitude: 13.1986, longitude: 77.7066, isHub: true },
  { code: "MAA", name: "Chennai International Airport",                     city: "Chennai",     country: "India", latitude: 12.9941, longitude: 80.1709, isHub: true },
  { code: "CCU", name: "Netaji Subhas Chandra Bose International Airport",  city: "Kolkata",     country: "India", latitude: 22.6547, longitude: 88.4467, isHub: true },
  { code: "HYD", name: "Rajiv Gandhi International Airport",                 city: "Hyderabad",   country: "India", latitude: 17.2403, longitude: 78.4294, isHub: true },
  { code: "AMD", name: "Sardar Vallabhbhai Patel International Airport",    city: "Ahmedabad",   country: "India", latitude: 23.0772, longitude: 72.6347, isHub: true },
  { code: "COK", name: "Cochin International Airport",                      city: "Kochi",       country: "India", latitude: 10.1520, longitude: 76.4019, isHub: true },

  /* ── INDIA: REGIONAL / SECONDARY AIRPORTS ── */
  { code: "PNQ", name: "Pune Airport",                              city: "Pune",                country: "India", latitude: 18.5821, longitude: 73.9197, isHub: false },
  { code: "GOI", name: "Goa International Airport (Dabolim)",       city: "Goa",                 country: "India", latitude: 15.3808, longitude: 73.8314, isHub: false },
  { code: "GOX", name: "Manohar International Airport (Mopa)",      city: "Goa",                 country: "India", latitude: 15.7400, longitude: 73.8333, isHub: false },
  { code: "JAI", name: "Jaipur International Airport",              city: "Jaipur",              country: "India", latitude: 26.8242, longitude: 75.8122, isHub: false },
  { code: "LKO", name: "Chaudhary Charan Singh International Airport", city: "Lucknow",          country: "India", latitude: 26.7606, longitude: 80.8893, isHub: false },
  { code: "VNS", name: "Lal Bahadur Shastri Airport",                city: "Varanasi",            country: "India", latitude: 25.4524, longitude: 82.8593, isHub: false },
  { code: "IXC", name: "Chandigarh International Airport",          city: "Chandigarh",          country: "India", latitude: 30.6735, longitude: 76.7885, isHub: false },
  { code: "ATQ", name: "Sri Guru Ram Dass Jee International Airport", city: "Amritsar",          country: "India", latitude: 31.7096, longitude: 74.7973, isHub: false },
  { code: "PAT", name: "Jay Prakash Narayan International Airport", city: "Patna",               country: "India", latitude: 25.5913, longitude: 85.0880, isHub: false },
  { code: "GAU", name: "Lokpriya Gopinath Bordoloi International Airport", city: "Guwahati",      country: "India", latitude: 26.1061, longitude: 91.5859, isHub: false },
  { code: "BBI", name: "Biju Patnaik International Airport",        city: "Bhubaneswar",         country: "India", latitude: 20.2444, longitude: 85.8178, isHub: false },
  { code: "IXR", name: "Birsa Munda Airport",                       city: "Ranchi",              country: "India", latitude: 23.3143, longitude: 85.3217, isHub: false },
  { code: "RPR", name: "Swami Vivekananda Airport",                 city: "Raipur",              country: "India", latitude: 21.1804, longitude: 81.7388, isHub: false },
  { code: "IDR", name: "Devi Ahilya Bai Holkar Airport",            city: "Indore",              country: "India", latitude: 22.7218, longitude: 75.8011, isHub: false },
  { code: "BHO", name: "Raja Bhoj Airport",                         city: "Bhopal",              country: "India", latitude: 23.2875, longitude: 77.3374, isHub: false },
  { code: "NAG", name: "Dr. Babasaheb Ambedkar International Airport", city: "Nagpur",            country: "India", latitude: 21.0922, longitude: 79.0472, isHub: false },
  { code: "SXR", name: "Sheikh ul-Alam International Airport",      city: "Srinagar",            country: "India", latitude: 33.9871, longitude: 74.7742, isHub: false },
  { code: "IXJ", name: "Jammu Airport",                             city: "Jammu",               country: "India", latitude: 32.6891, longitude: 74.8378, isHub: false },
  { code: "DED", name: "Jolly Grant Airport",                       city: "Dehradun",            country: "India", latitude: 30.1897, longitude: 78.1804, isHub: false },
  { code: "IXA", name: "Agartala Airport (Maharaja Bir Bikram)",    city: "Agartala",            country: "India", latitude: 23.8870, longitude: 91.2404, isHub: false },
  { code: "IXB", name: "Bagdogra Airport",                          city: "Siliguri",            country: "India", latitude: 26.6812, longitude: 88.3286, isHub: false },
  { code: "IXZ", name: "Veer Savarkar International Airport",       city: "Port Blair",          country: "India", latitude: 11.6411, longitude: 92.7297, isHub: false },
  { code: "TRV", name: "Trivandrum International Airport",         city: "Thiruvananthapuram",  country: "India", latitude: 8.4821,  longitude: 76.9202, isHub: false },
  { code: "CJB", name: "Coimbatore International Airport",         city: "Coimbatore",           country: "India", latitude: 11.0300, longitude: 77.0434, isHub: false },
  { code: "VTZ", name: "Visakhapatnam Airport",                     city: "Visakhapatnam",        country: "India", latitude: 17.7211, longitude: 83.2245, isHub: false },
  { code: "VGA", name: "Vijayawada Airport",                        city: "Vijayawada",           country: "India", latitude: 16.5304, longitude: 80.7967, isHub: false },
  { code: "IXM", name: "Madurai Airport",                           city: "Madurai",              country: "India", latitude: 9.8345,  longitude: 78.0934, isHub: false },
  { code: "STV", name: "Surat Airport",                             city: "Surat",                country: "India", latitude: 21.1141, longitude: 72.7418, isHub: false },
  { code: "RAJ", name: "Rajkot International Airport (Hirasar)",   city: "Rajkot",                country: "India", latitude: 22.3092, longitude: 70.7795, isHub: false },
  { code: "UDR", name: "Maharana Pratap Airport",                   city: "Udaipur",              country: "India", latitude: 24.6177, longitude: 73.8961, isHub: false },
  { code: "JDH", name: "Jodhpur Airport",                           city: "Jodhpur",              country: "India", latitude: 26.2511, longitude: 73.0489, isHub: false },
  { code: "IXL", name: "Kushok Bakula Rimpochee Airport",          city: "Leh",                   country: "India", latitude: 34.1359, longitude: 77.5465, isHub: false },
  { code: "ISK", name: "Nashik Airport (Ozar)",                     city: "Nashik",               country: "India", latitude: 20.1190, longitude: 73.9125, isHub: false },
  { code: "TIR", name: "Tirupati Airport",                          city: "Tirupati",             country: "India", latitude: 13.6325, longitude: 79.5433, isHub: false },
  { code: "IMF", name: "Bir Tikendrajit International Airport",    city: "Imphal",                country: "India", latitude: 24.7600, longitude: 93.8967, isHub: false },

  /* ── MAJOR INTERNATIONAL HUBS ── */
  { code: "DXB", name: "Dubai International Airport",          city: "Dubai",        country: "UAE",            latitude: 25.2532,  longitude: 55.3657,  isHub: true },
  { code: "AUH", name: "Zayed International Airport",          city: "Abu Dhabi",    country: "UAE",            latitude: 24.4330,  longitude: 54.6511,  isHub: true },
  { code: "DOH", name: "Hamad International Airport",          city: "Doha",         country: "Qatar",          latitude: 25.2731,  longitude: 51.6081,  isHub: true },
  { code: "SIN", name: "Singapore Changi Airport",              city: "Singapore",    country: "Singapore",      latitude: 1.3644,   longitude: 103.9915, isHub: true },
  { code: "BKK", name: "Suvarnabhumi Airport",                  city: "Bangkok",      country: "Thailand",       latitude: 13.6900,  longitude: 100.7501, isHub: true },
  { code: "KUL", name: "Kuala Lumpur International Airport",   city: "Kuala Lumpur", country: "Malaysia",       latitude: 2.7456,   longitude: 101.7099, isHub: true },
  { code: "LHR", name: "Heathrow Airport",                      city: "London",       country: "United Kingdom", latitude: 51.4700,  longitude: -0.4543,  isHub: true },
  { code: "CDG", name: "Charles de Gaulle Airport",             city: "Paris",        country: "France",         latitude: 49.0097,  longitude: 2.5479,   isHub: true },
  { code: "FRA", name: "Frankfurt Airport",                     city: "Frankfurt",    country: "Germany",        latitude: 50.0379,  longitude: 8.5622,   isHub: true },
  { code: "AMS", name: "Amsterdam Airport Schiphol",            city: "Amsterdam",    country: "Netherlands",    latitude: 52.3105,  longitude: 4.7683,   isHub: true },
  { code: "IST", name: "Istanbul Airport",                      city: "Istanbul",     country: "Turkey",         latitude: 41.2753,  longitude: 28.7519,  isHub: true },
  { code: "JFK", name: "John F. Kennedy International Airport", city: "New York",     country: "USA",            latitude: 40.6413,  longitude: -73.7781, isHub: true },
  { code: "LAX", name: "Los Angeles International Airport",    city: "Los Angeles",  country: "USA",            latitude: 33.9416,  longitude: -118.4085, isHub: true },
  { code: "ORD", name: "O'Hare International Airport",         city: "Chicago",      country: "USA",            latitude: 41.9742,  longitude: -87.9073, isHub: true },
  { code: "HKG", name: "Hong Kong International Airport",      city: "Hong Kong",    country: "Hong Kong",      latitude: 22.3080,  longitude: 113.9185, isHub: true },
  { code: "NRT", name: "Narita International Airport",         city: "Tokyo",        country: "Japan",          latitude: 35.7720,  longitude: 140.3929, isHub: true },
  { code: "ICN", name: "Incheon International Airport",        city: "Seoul",        country: "South Korea",    latitude: 37.4602,  longitude: 126.4407, isHub: true },
  { code: "SYD", name: "Sydney Kingsford Smith Airport",       city: "Sydney",       country: "Australia",      latitude: -33.9399, longitude: 151.1753, isHub: true },

  /* ── REGIONAL INTERNATIONAL (South Asia, non-hub) ── */
  { code: "CMB", name: "Bandaranaike International Airport",   city: "Colombo",      country: "Sri Lanka",      latitude: 7.1808,   longitude: 79.8841,  isHub: false },
  { code: "KTM", name: "Tribhuvan International Airport",      city: "Kathmandu",    country: "Nepal",          latitude: 27.6966,  longitude: 85.3591,  isHub: false },
  { code: "DAC", name: "Hazrat Shahjalal International Airport", city: "Dhaka",      country: "Bangladesh",     latitude: 23.8433,  longitude: 90.3978,  isHub: false },
];

/* ──────────────────────────────────────────────────────────
   Freeze the dataset so downstream modules (graph builder,
   route engine) cannot accidentally mutate shared airport
   objects at runtime.
   ────────────────────────────────────────────────────────── */
AIRPORTS.forEach(function (a) { Object.freeze(a); });
Object.freeze(AIRPORTS);
