"""
MedGuard AI - NotebookLM Module
📊 Document Summarizer & Semantic Search Engine

Inspired by Google NotebookLM — this module:
  1. Ingests medical documents (clinical summaries, lab reports, etc.)
  2. Chunks them intelligently (by section, not by arbitrary length)
  3. Creates vector embeddings using sentence-transformers (free, local)
  4. Stores embeddings in FAISS for fast similarity search
  5. Provides semantic search across the entire patient corpus
  6. Generates AI summaries and insights

Works 100% locally — no API keys needed for search & embeddings.
"""
import os
import re
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import numpy as np

from medguard.utils.config import EMBEDDING_MODEL, VECTOR_STORE_DIR


class MedicalDocumentChunker:
    """
    Intelligent document chunker designed for medical records.
    Splits documents by clinical sections rather than arbitrary character counts.
    """
    
    SECTION_HEADERS = [
        "PATIENT CLINICAL SUMMARY",
        "ALLERGIES",
        "ACTIVE MEDICATIONS",
        "DIAGNOSES",
        "LATEST VITALS",
        "ABNORMAL LAB RESULTS",
        "RECENT ENCOUNTERS",
    ]
    
    def __init__(self, chunk_size: int = 500, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def chunk_document(self, text: str, doc_id: str = "") -> List[Dict[str, Any]]:
        """
        Split a medical document into meaningful chunks.
        Tries to split on section boundaries first, then falls back to size.
        """
        chunks = []
        
        # Try section-based splitting
        sections = self._split_by_sections(text)
        
        if sections:
            for section_name, section_text in sections:
                if len(section_text.strip()) > 10:  # Skip empty sections
                    # If section is too long, sub-chunk it
                    if len(section_text) > self.chunk_size:
                        sub_chunks = self._split_by_size(section_text)
                        for i, sub in enumerate(sub_chunks):
                            chunks.append({
                                "text": sub,
                                "doc_id": doc_id,
                                "section": section_name,
                                "chunk_index": len(chunks),
                                "metadata": {
                                    "section": section_name,
                                    "sub_chunk": i,
                                }
                            })
                    else:
                        chunks.append({
                            "text": section_text.strip(),
                            "doc_id": doc_id,
                            "section": section_name,
                            "chunk_index": len(chunks),
                            "metadata": {"section": section_name}
                        })
        else:
            # Fallback: split by size
            for i, sub in enumerate(self._split_by_size(text)):
                chunks.append({
                    "text": sub,
                    "doc_id": doc_id,
                    "section": "full_document",
                    "chunk_index": i,
                    "metadata": {}
                })
        
        return chunks
    
    def _split_by_sections(self, text: str) -> List[Tuple[str, str]]:
        """Split document by medical section headers."""
        sections = []
        pattern = "|".join(re.escape(h) for h in self.SECTION_HEADERS)
        parts = re.split(f"({pattern})", text, flags=re.IGNORECASE)
        
        if len(parts) <= 1:
            return []
        
        current_header = "HEADER"
        for part in parts:
            clean = part.strip()
            if clean.upper() in [h.upper() for h in self.SECTION_HEADERS]:
                current_header = clean
            else:
                if clean:
                    sections.append((current_header, clean))
        
        return sections
    
    def _split_by_size(self, text: str) -> List[str]:
        """Split text into chunks by size with overlap."""
        chunks = []
        words = text.split()
        
        chunk_words = self.chunk_size // 5  # approx 5 chars per word
        overlap_words = self.overlap // 5
        
        start = 0
        while start < len(words):
            end = min(start + chunk_words, len(words))
            chunk = " ".join(words[start:end])
            if chunk.strip():
                chunks.append(chunk)
            start = end - overlap_words if end < len(words) else end
        
        return chunks


class VectorKnowledgeBase:
    """
    FAISS-based vector knowledge base for semantic search.
    Uses sentence-transformers for free, local embeddings.
    """
    
    def __init__(self, model_name: str = None):
        self.model_name = model_name or EMBEDDING_MODEL
        self.model = None
        self.index = None
        self.documents: List[Dict[str, Any]] = []
        self.is_built = False
    
    def _load_model(self):
        """Lazy-load the embedding model."""
        if self.model is None:
            try:
                from sentence_transformers import SentenceTransformer
                print(f"📥 Loading embedding model: {self.model_name}...")
                self.model = SentenceTransformer(self.model_name)
                print(f"✅ Model loaded successfully")
            except ImportError:
                print("⚠️ sentence-transformers not installed. Using TF-IDF fallback.")
                self.model = "tfidf_fallback"
    
    def _embed(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for a list of texts."""
        self._load_model()
        
        if self.model == "tfidf_fallback":
            return self._tfidf_embed(texts)
        
        embeddings = self.model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
        return embeddings
    
    def _tfidf_embed(self, texts: List[str]) -> np.ndarray:
        """Fallback TF-IDF based embeddings if sentence-transformers unavailable."""
        from sklearn.feature_extraction.text import TfidfVectorizer
        
        if not hasattr(self, '_tfidf_vectorizer'):
            self._tfidf_vectorizer = TfidfVectorizer(max_features=384, stop_words='english')
            vectors = self._tfidf_vectorizer.fit_transform(texts)
        else:
            vectors = self._tfidf_vectorizer.transform(texts)
        
        return vectors.toarray().astype(np.float32)
    
    def build_index(self, documents: List[Dict[str, Any]]):
        """
        Build FAISS index from document chunks.
        
        Args:
            documents: List of dicts with 'text' key and optional metadata
        """
        import faiss
        
        self.documents = documents
        texts = [doc["text"] for doc in documents]
        
        print(f"🔨 Building vector index for {len(texts)} chunks...")
        embeddings = self._embed(texts)
        
        # Build FAISS index
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dimension)  # Inner product (cosine-like)
        
        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings)
        self.index.add(embeddings)
        
        self.is_built = True
        print(f"✅ Vector index built: {self.index.ntotal} vectors, {dimension}D")
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Semantic search across the knowledge base.
        
        Args:
            query: Natural language query
            top_k: Number of results to return
            
        Returns:
            List of matching documents with similarity scores
        """
        if not self.is_built:
            raise ValueError("Index not built. Call build_index() first.")
        
        import faiss
        
        query_embedding = self._embed([query])
        faiss.normalize_L2(query_embedding)
        
        scores, indices = self.index.search(query_embedding, top_k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self.documents):
                result = {
                    **self.documents[idx],
                    "similarity_score": float(score),
                }
                results.append(result)
        
        return results
    
    def save(self, path: str = None):
        """Save the vector index and documents to disk."""
        import faiss
        
        save_dir = Path(path or VECTOR_STORE_DIR)
        save_dir.mkdir(parents=True, exist_ok=True)
        
        if self.index:
            faiss.write_index(self.index, str(save_dir / "index.faiss"))
        
        with open(save_dir / "documents.json", "w") as f:
            json.dump(self.documents, f, indent=2, default=str)
        
        print(f"💾 Vector store saved to {save_dir}")
    
    def load(self, path: str = None):
        """Load vector index and documents from disk."""
        import faiss
        
        load_dir = Path(path or VECTOR_STORE_DIR)
        
        index_path = load_dir / "index.faiss"
        docs_path = load_dir / "documents.json"
        
        if index_path.exists() and docs_path.exists():
            self.index = faiss.read_index(str(index_path))
            with open(docs_path, "r") as f:
                self.documents = json.load(f)
            self.is_built = True
            print(f"📂 Vector store loaded: {self.index.ntotal} vectors")
        else:
            print(f"⚠️ No vector store found at {load_dir}")


class NotebookLMEngine:
    """
    📊 NotebookLM-Style Document Intelligence Engine
    
    Combines chunking, embedding, search, and summarization
    to create an intelligent document analysis system.
    """
    
    def __init__(self):
        self.chunker = MedicalDocumentChunker()
        self.knowledge_base = VectorKnowledgeBase()
        self.ingested_docs: Dict[str, str] = {}
    
    def ingest_documents(self, doc_dir: str = None):
        """
        Ingest all clinical summary documents into the knowledge base.
        
        Args:
            doc_dir: Directory containing .txt clinical summaries
        """
        if doc_dir is None:
            doc_dir = Path(__file__).parent.parent.parent / "data" / "summaries"
        else:
            doc_dir = Path(doc_dir)
        
        if not doc_dir.exists():
            print(f"⚠️ Document directory not found: {doc_dir}")
            print("   Run `python -m medguard.data.generator` first.")
            return
        
        all_chunks = []
        txt_files = list(doc_dir.glob("*.txt"))
        
        print(f"📄 Ingesting {len(txt_files)} documents...")
        
        for filepath in txt_files:
            doc_id = filepath.stem
            text = filepath.read_text(encoding="utf-8")
            self.ingested_docs[doc_id] = text
            
            chunks = self.chunker.chunk_document(text, doc_id=doc_id)
            all_chunks.extend(chunks)
        
        print(f"📦 Created {len(all_chunks)} chunks from {len(txt_files)} documents")
        
        # Build vector index
        self.knowledge_base.build_index(all_chunks)
        self.knowledge_base.save()
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Semantic search across all ingested documents."""
        if not self.knowledge_base.is_built:
            # Try loading from disk
            self.knowledge_base.load()
        
        if not self.knowledge_base.is_built:
            return [{"error": "No documents ingested. Run ingest_documents() first."}]
        
        return self.knowledge_base.search(query, top_k)
    
    def get_document_insights(self) -> Dict[str, Any]:
        """Generate insights about the ingested document corpus."""
        if not self.ingested_docs:
            return {"error": "No documents ingested"}
        
        total_docs = len(self.ingested_docs)
        total_chars = sum(len(text) for text in self.ingested_docs.values())
        avg_length = total_chars / total_docs if total_docs > 0 else 0
        
        return {
            "total_documents": total_docs,
            "total_characters": total_chars,
            "average_document_length": int(avg_length),
            "total_chunks": self.knowledge_base.index.ntotal if self.knowledge_base.is_built else 0,
            "embedding_model": self.knowledge_base.model_name,
        }
    
    def format_search_results(self, results: List[Dict[str, Any]], query: str) -> str:
        """Format search results into a readable string."""
        lines = [
            f"📊 NotebookLM Search Results",
            f"Query: '{query}'",
            f"{'─' * 50}",
        ]
        
        for i, result in enumerate(results, 1):
            score = result.get("similarity_score", 0)
            doc_id = result.get("doc_id", "unknown")
            section = result.get("section", "")
            text = result.get("text", "")[:200]
            
            lines.extend([
                f"\n  [{i}] Score: {score:.3f} | Doc: {doc_id} | Section: {section}",
                f"  {text}...",
            ])
        
        return "\n".join(lines)
