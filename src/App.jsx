import { useEffect, useState } from "react";
import "./App.css";

const BOOKS_PER_PAGE = 25;
const BASE_API_URL = "https://graphic-novel-price-api.onrender.com";

function App() {
  const [books, setBooks] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("Loading price data...");
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [priceHistoryTimeline, setPriceHistoryTimeline] = useState([]);

  // 1. Fetch Top Deals from Render Database API on Component Load
  useEffect(() => {
    setLoadingMessage("Fetching today's top deals from your SQLite database...");
    
    fetch(`${BASE_API_URL}/deals?limit=500000`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not communicate with the running API server.");
        return res.json();
      })
      .then(async (dealsData) => {
        const groupedBooks = {};

        dealsData.forEach((row) => {
          const isbn = String(row.isbn || "").trim();
          const retailer = String(row.retailer || "").trim();
          const price = Number(row.price);
          const realTitle = row.title ? String(row.title).trim() : `Graphic Novel (${isbn})`;
          const trueUrl = row.url || "#";

          if (!isbn || !retailer || Number.isNaN(price)) return;

          if (!groupedBooks[isbn]) {
            groupedBooks[isbn] = {
              id: isbn,
              isbn,
              title: realTitle,
              cover: createPlaceholderCover(realTitle),
              fallbackCover: createPlaceholderCover(realTitle),
              retailers: [],
            };
          }

          groupedBooks[isbn].retailers.push({ name: retailer, price, url: trueUrl });
        });

        const formattedBooks = Object.values(groupedBooks)
          .filter((book) => book.retailers.length > 0)
          .sort((a, b) => a.title.localeCompare(b.title));

        const booksWithCovers = await Promise.all(
          formattedBooks.map(async (book) => {
            const cover = await findBestCover(book.isbn, book.title);
            return { ...book, cover };
          })
        );

        setBooks(booksWithCovers);
        setLoadingMessage("");
      })
      .catch((err) => {
        console.error(err);
        setLoadingMessage("Failed to pull database framework. Please check if Uvicorn is active on port 8000.");
      });
  }, []);

  // 2. Cover Image Fallback Engine (Open Library + Google Books API)
  async function findBestCover(isbn, title) {
    const placeholder = createPlaceholderCover(title);
    const openLibraryCover = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

    if (await imageExists(openLibraryCover)) return openLibraryCover;

    const googleCoverByIsbn = await getGoogleBooksCover(`isbn:${isbn}`);
    if (googleCoverByIsbn) return googleCoverByIsbn;

    const googleCoverByTitle = await getGoogleBooksCover(`intitle:${encodeURIComponent(title)}`);
    if (googleCoverByTitle) return googleCoverByTitle;

    return placeholder;
  }

  async function imageExists(url) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
  }

  async function getGoogleBooksCover(query) {
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}`);
      if (!response.ok) return null;
      const data = await response.json();
      const imageLinks = data.items?.[0]?.volumeInfo?.imageLinks;
      if (!imageLinks) return null;
      return (
        imageLinks.extraLarge ||
        imageLinks.large ||
        imageLinks.medium ||
        imageLinks.small ||
        imageLinks.thumbnail ||
        imageLinks.smallThumbnail ||
        null
      );
    } catch {
      return null;
    }
  }

  function createPlaceholderCover(title) {
    const shortTitle = encodeURIComponent(title.slice(0, 30));
    return `https://placehold.co/300x450/1f2937/c084fc?text=${shortTitle}`;
  }

  function handleImageError(event, fallbackCover) {
    event.currentTarget.src = fallbackCover;
  }

  // 3. Dynamic API Search (Fixed template literals utilizing proper backticks)
  function handleSearch() {
    const query = searchInput.trim();
    if (!query) return;

    setSearchTerm(query);
    setSelectedBook(null);
    setCurrentPage(1);
    setShowSuggestions(false);
    setLoadingMessage(`Searching database records for "${query}"...`);

    fetch(`${BASE_API_URL}/book/${encodeURIComponent(query)}/prices`)
      .then((res) => {
        if (!res.ok) throw new Error("Server error");
        return res.json();
      })
      .then(async (pricesData) => {
        if (!pricesData || pricesData.length === 0) {
          setBooks([]);
          setLoadingMessage(`No records found for "${query}".`);
          return;
        }

        const firstMatch = pricesData[0];
        const realTitle = firstMatch.title || `Graphic Novel (${query})`;
        const realIsbn = firstMatch.isbn || query;

        const searchedBook = {
          id: realIsbn,
          isbn: realIsbn,
          title: realTitle,
          cover: await findBestCover(realIsbn, realTitle),
          fallbackCover: createPlaceholderCover(realTitle),
          retailers: pricesData.map((item) => ({
            name: item.retailer,
            price: item.price,
            url: item.url || "#"
          }))
        };

        setBooks([searchedBook]);
        setLoadingMessage("");
      })
      .catch((err) => {
        console.error(err);
        setLoadingMessage("Error reading matching rows from database pipelines.");
      });
  }

  // 4. Handle Item View Focus and Timeline Data Pull (Fixed template literals)
  function handleSelectBook(book) {
    setSelectedBook(book);
    setPriceHistoryTimeline([]);

    fetch(`${BASE_API_URL}/book/${book.isbn}/history`)
      .then((res) => res.json())
      .then((data) => {
        setPriceHistoryTimeline(data.history || []);
      })
      .catch((err) => console.error("Error reading book tracker timestamp metrics:", err));
  }

  // 5. Client Pagination & Auto-Suggestions Processing
  const filteredBooks = books.filter((book) => {
    const search = searchTerm.toLowerCase();
    return (
      book.title.toLowerCase().includes(search) ||
      book.isbn.toLowerCase().includes(search)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / BOOKS_PER_PAGE));
  const startIndex = (currentPage - 1) * BOOKS_PER_PAGE;
  const visibleBooks = filteredBooks.slice(startIndex, startIndex + BOOKS_PER_PAGE);

  const suggestions =
    showSuggestions && searchInput.trim().length > 0
      ? books
          .filter((book) => {
            const search = searchInput.toLowerCase();
            return (
              book.title.toLowerCase().includes(search) ||
              book.isbn.toLowerCase().includes(search)
            );
          })
          .slice(0, 6)
      : [];

  function handleSuggestionClick(book) {
    setSearchInput(book.title);
    setSearchTerm(book.title);
    handleSelectBook(book);
    setShowSuggestions(false);
  }

  function handlePreviousPage() {
    setCurrentPage((page) => Math.max(1, page - 1));
  }

  function handleNextPage() {
    setCurrentPage((page) => Math.min(totalPages, page + 1));
  }

  function handleJumpToPage(event) {
    event.preventDefault();
    const requestedPage = Number(jumpPage);
    if (!requestedPage || Number.isNaN(requestedPage)) return;
    const safePage = Math.min(Math.max(requestedPage, 1), totalPages);
    setCurrentPage(safePage);
    setJumpPage("");
  }

  // 6. Pricing Metric Calculations
  function getBestRetailer(book) {
    if (!book.retailers || book.retailers.length === 0) return { name: "N/A", price: 0 };
    return book.retailers.reduce((best, current) =>
      current.price < best.price ? current : best
    );
  }

  function getHighestListedPrice(book) {
    if (!book.retailers || book.retailers.length === 0) return 0;
    return Math.max(...book.retailers.map((retailer) => retailer.price));
  }

  function getDiscount(book, price) {
    const highestListedPrice = getHighestListedPrice(book);
    if (!highestListedPrice || highestListedPrice <= price) return 0;
    return Math.round(((highestListedPrice - price) / highestListedPrice) * 100);
  }

  // View Mode: Individual Book Details Layout
  if (selectedBook) {
    const bestRetailer = getBestRetailer(selectedBook);
    const highestListedPrice = getHighestListedPrice(selectedBook);

    return (
      <main className="app">
        <button className="back-button" onClick={() => setSelectedBook(null)}>
          ← Back to deals
        </button>

        <section className="details-layout">
          <div className="cover-panel">
            <img
              src={selectedBook.cover}
              alt={selectedBook.title}
              onError={(event) =>
                handleImageError(event, selectedBook.fallbackCover)
              }
            />
          </div>

          <div className="details-info">
            <p className="eyebrow">Graphic Novel Deal</p>
            <h1>{selectedBook.title}</h1>
            <p className="rating">ISBN: {selectedBook.isbn}</p>

            <div className="deal-summary">
              <div>
                <span>Lowest price</span>
                <strong>${bestRetailer.price.toFixed(2)}</strong>
                <p>{bestRetailer.name}</p>
              </div>

              <div>
                <span>Highest listed price</span>
                <strong>${highestListedPrice.toFixed(2)}</strong>
                <p>Used as comparison price</p>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Chronological History Timeline View Section */}
        {priceHistoryTimeline.length > 0 && (
          <section className="prices-section" style={{ marginBottom: "30px" }}>
            <h2>📈 Price Tracking Timeline Trends</h2>
            <div style={{ maxHeight: "200px", overflowY: "auto", background: "#111827", padding: "20px", borderRadius: "12px", border: "1px solid #374151" }}>
              {priceHistoryTimeline.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", margin: "10px 0", color: "#f3f4f6", borderBottom: "1px dashed #4b5563", paddingBottom: "6px", fontSize: "0.95rem" }}>
                  <span style={{ color: "#9ca3af" }}>Timestamp: {item.date}</span>
                  <span>{item.retailer}: <strong style={{ color: "#a855f7" }}>${Number(item.price).toFixed(2)}</strong></span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Current Competitive Outlets Section */}
        <section className="prices-section">
          <h2>Current Prices Across Outlets</h2>

          {selectedBook.retailers.map((retailer) => {
            const isBest = retailer.name === bestRetailer.name;
            const discount = getDiscount(selectedBook, retailer.price);

            return (
              <div
                className={`price-row ${isBest ? "best-row" : ""}`}
                key={`${retailer.name}-${retailer.url}-${retailer.price}`}
              >
                <div>
                  <h3>{retailer.name}</h3>
                  <p>Verified Daily Outlet</p>
                </div>

                <div className="price-side">
                  <span className="price">${retailer.price.toFixed(2)}</span>
                  {discount > 0 && <span className="discount">-{discount}%</span>}
                  {isBest && <span className="best-tag">Best Deal</span>}

                  <a
                    href={retailer.url || "#"}
                    className="view-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    );
  }

  // View Mode: Home Browse Deals Grid Layout
  return (
    <main className="app">
      <header className="topbar">
        <h1>Graphic Novel Price Tracker</h1>

        <form
          className="topbar-search"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search by Title or ISBN..."
              value={searchInput}
              onFocus={() => setShowSuggestions(true)}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setShowSuggestions(true);
              }}
            />

            {suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((book) => (
                  <button
                    type="button"
                    key={book.id}
                    onClick={() => handleSuggestionClick(book)}
                  >
                    {book.title}
                    <span className="suggestion-isbn">ISBN: {book.isbn}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="submit">Search</button>
        </form>
      </header>

      {loadingMessage ? (
        <section className="status-card">
          <p>{loadingMessage}</p>
        </section>
      ) : (
        <>
          <section className="book-grid">
            {visibleBooks.map((book) => {
              const bestRetailer = getBestRetailer(book);
              const discount = getDiscount(book, bestRetailer.price);

              return (
                <article
                  className="book-card"
                  key={book.id}
                  onClick={() => handleSelectBook(book)}
                  role="button"
                  tabIndex="0"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSelectBook(book);
                    }
                  }}
                >
                  <img
                    src={book.cover}
                    alt={book.title}
                    onError={(event) =>
                      handleImageError(event, book.fallbackCover)
                    }
                  />

                  <div className="card-content">
                    <h3>{book.title}</h3>

                    <div className="card-prices">
                      <span className="new-price">
                        ${bestRetailer.price.toFixed(2)}
                      </span>
                      {discount > 0 && (
                        <span className="discount">-{discount}%</span>
                      )}
                    </div>

                    <p className="best-deal">Best Deal: {bestRetailer.name}</p>

                    <button
                      className="card-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSelectBook(book);
                      }}
                    >
                      View Prices
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          {/* Pagination Navigation Elements Section */}
          <section className="pagination">
            <button onClick={handlePreviousPage} disabled={currentPage === 1}>
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button onClick={handleNextPage} disabled={currentPage === totalPages}>
              Next
            </button>

            <form onSubmit={handleJumpToPage} className="jump-form">
              <input
                type="number"
                min="1"
                max={totalPages}
                placeholder="Jump to page"
                value={jumpPage}
                onChange={(event) => setJumpPage(event.target.value)}
              />
              <button type="submit">Go</button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

export default App;