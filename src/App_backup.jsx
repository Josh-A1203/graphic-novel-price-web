import { useState } from "react";
import { books } from "./data";
import "./App.css";

function App() {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleSearch() {
    setSearchTerm(searchInput);
  }

  return (
    <div className="app">
      <h1>Graphic Novel Price Tracker</h1>

      <p className="subtitle">
        Compare prices across Amazon, Barnes & Noble, CGN, and OPB.
      </p>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search graphic novel..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <button onClick={handleSearch}>Search</button>
      </div>

      <h2>Results</h2>

      <div className="book-grid">
        {filteredBooks.map((book) => (
          <div className="book-card" key={book.id}>
            <h3>{book.title}</h3>
            <p className="msrp">MSRP: {book.msrp}</p>

            <div className="retailer-row">
              <span>Amazon</span>
              <strong>{book.amazon}</strong>
            </div>

            <div className="retailer-row">
              <span>CGN</span>
              <strong>{book.cgn}</strong>
            </div>

            <div className="retailer-row">
              <span>OPB</span>
              <strong>{book.opb}</strong>
            </div>

            <div className="retailer-row">
              <span>Barnes & Noble</span>
              <strong>{book.barnes}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;