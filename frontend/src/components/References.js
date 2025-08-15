import React, { useState } from 'react';
import '../styles/References.css';

const References = ({ references }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="references-container">
      <button 
        className="references-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label="Toggle references"
      >
        References [{references.length}] {isExpanded ? '−' : '+'}
      </button>
      
      {isExpanded && (
        <div className="references-list">
          <h3>References</h3>
          <ol>
            {references.map((ref, index) => (
              <li key={index} className="reference-item">
                {ref.authors && <span className="ref-authors">{ref.authors}. </span>}
                {ref.title && <span className="ref-title">"{ref.title}." </span>}
                {ref.source && <span className="ref-source">{ref.source}. </span>}
                {ref.date && <span className="ref-date">{ref.date}. </span>}
                {ref.url && (
                  <a 
                    href={ref.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ref-link"
                  >
                    Link
                  </a>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default References;