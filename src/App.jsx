import { useEffect, useState } from "react";
import Papa from "papaparse";
import "./App.css";

const BOOKS_PER_PAGE = 25;

function App() {
  const [books, setBooks] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("Loading price data...");
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetch("/data/prices.csv")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load prices.csv");
        return response.text();
      })
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const groupedBooks = {};

            results.data.forEach((row) => {
              const isbn = cleanValue(row.isbn);
              const title = cleanValue(row.title);
              const retailer = cleanValue(row.retailer);
              const url = cleanValue(row.url);
              const price = Number(cleanValue(row.price));

              if (!isbn || !title || !retailer || !price || Number.isNaN(price)) return;

              if (!groupedBooks[isbn]) {
                groupedBooks[isbn] = {
                  id: isbn,
                  isbn,
                  title,
                  cover: createPlaceholderCover(title),
                  fallbackCover: createPlaceholderCover(title),
                  retailers: [],
                };
              }

              groupedBooks[isbn].retailers.push({ name: retailer, price, url });
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
          },
          error: () => setLoadingMessage("Could not parse the price data."),
        });
      })
      .catch(() => {
        setLoadingMessage(
          "Could not load price data. Make sure public/data/prices.csv exists."
        );
      });
  }, []);

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

  function cleanValue(value) {
    return String(value || "").trim();
  }

  function getOpenLibraryCover(isbn) {
    return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  }

  async function findBestCover(isbn, title) {
    const placeholder = createPlaceholderCover(title);
    const openLibraryCover = getOpenLibraryCover(isbn);

    if (await imageExists(openLibraryCover)) return openLibraryCover;

    const googleCoverByIsbn = await getGoogleBooksCover(`isbn:${isbn}`);
    if (googleCoverByIsbn) return googleCoverByIsbn;

    const googleCoverByTitle = await getGoogleBooksCover(
      `intitle:${encodeURIComponent(title)}`
    );
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
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${query}`
      );

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

function handleSearch() {
  const cleanedSearch = searchInput.trim();

  setSearchTerm(cleanedSearch);
  setSelectedBook(null);
  setCurrentPage(1);
  setJumpPage("");
  setShowSuggestions(false);
}

  function handleSuggestionClick(book) {
    setSearchInput(book.title);
    setSearchTerm(book.title);
    setSelectedBook(null);
    setCurrentPage(1);
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

  function getBestRetailer(book) {
    return book.retailers.reduce((best, current) =>
      current.price < best.price ? current : best
    );
  }

  function getHighestListedPrice(book) {
    return Math.max(...book.retailers.map((retailer) => retailer.price));
  }

  function getDiscount(book, price) {
    const highestListedPrice = getHighestListedPrice(book);
    if (!highestListedPrice || highestListedPrice <= price) return 0;
    return Math.round(((highestListedPrice - price) / highestListedPrice) * 100);
  }

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

        <section className="prices-section">
          <h2>Current Prices</h2>

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
                  <p>Online retailer</p>
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
  placeholder="Search title or ISBN..."
  value={searchInput}
  onFocus={() => setShowSuggestions(true)}
  onChange={(event) => {
    setSearchInput(event.target.value);
    setShowSuggestions(true);
    setCurrentPage(1);
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
                  onClick={() => setSelectedBook(book)}
                  role="button"
                  tabIndex="0"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setSelectedBook(book);
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
                        setSelectedBook(book);
                      }}
                    >
                      View Prices
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="pagination">
            <button onClick={handlePreviousPage} disabled={currentPage === 1}>
              Previous
            </button>

            <span>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
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