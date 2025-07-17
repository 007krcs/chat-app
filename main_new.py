import fitz  # PyMuPDF
import pandas as pd
import re
import json
from typing import List, Dict, Any, Optional, Tuple
import google.generativeai as genai
from datetime import datetime
import hashlib
import numpy as np
from dataclasses import dataclass
from enum import Enum

# Vector Database imports
try:
    import chromadb
    from chromadb.utils import embedding_functions
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

class QuestionType(Enum):
    YES_NO = "yes_no"
    TEXT = "text"
    DATE = "date"
    SELECTION = "selection"
    MULTI_SELECT = "multi_select"
    NUMERIC = "numeric"

@dataclass
class Question:
    id: str
    text: str
    type: QuestionType
    category: str
    country: str
    required: bool = True
    options: List[str] = None
    help_text: str = ""
    regulatory_context: str = ""
    compliance_area: str = ""

@dataclass
class UserResponse:
    question_id: str
    answer: Any
    timestamp: str
    confidence: float = 1.0

class NCAQuestionnaireSystem:
    def __init__(self, gemini_api_key: str, db_path: str = "./nca_system_db"):
        """
        Initialize the NCA Questionnaire System
        
        Args:
            gemini_api_key: Google Gemini API key
            db_path: Path for ChromaDB storage
        """
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        self.db_path = db_path
        
        if not CHROMA_AVAILABLE:
            raise ImportError("ChromaDB not installed. Run: pip install chromadb")
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(path=db_path)
        self.embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        
        # Initialize collections
        self.questions_collection = self.client.get_or_create_collection(
            name="nca_questions",
            embedding_function=self.embedding_function
        )
        
        self.responses_collection = self.client.get_or_create_collection(
            name="user_responses",
            embedding_function=self.embedding_function
        )
        
        self.countries = self._load_supported_countries()
    
    def _load_supported_countries(self) -> List[str]:
        """Load list of supported countries"""
        return [
            "United Arab Emirates", "Saudi Arabia", "Kuwait", "Qatar", 
            "Bahrain", "Oman", "Jordan", "Lebanon", "Egypt", "Morocco",
            "Tunisia", "Algeria", "Iraq", "Yemen", "Syria", "Sudan", 
            "Libya", "Palestine"
        ]
    
    # =================== CASE 1: UPLOAD QUESTIONNAIRE BY COUNTRY ===================
    
    def extract_text_from_pdf(self, pdf_path: str) -> List[str]:
        """Extract text from all pages of PDF"""
        doc = fitz.open(pdf_path)
        pages_text = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            pages_text.append(text)
        
        doc.close()
        return pages_text
    
    def extract_country_from_text(self, text: str) -> str:
        """Extract country information from the document text"""
        # Check for explicit country mentions
        for country in self.countries:
            if country.lower() in text.lower():
                return country
        
        # Use Gemini to extract country
        prompt = f"""
        Extract the country name from the following NCA document text.
        Return only the country name from this list: {', '.join(self.countries)}
        If no country is found, return 'Unknown'.
        
        Text: {text[:2000]}...
        """
        
        try:
            response = self.model.generate_content(prompt)
            country = response.text.strip()
            return country if country in self.countries else 'Unknown'
        except Exception as e:
            print(f"Error extracting country: {e}")
            return 'Unknown'
    
    def extract_questions_from_pdf(self, pdf_path: str) -> List[Question]:
        """
        Extract questions from PDF and convert to structured Question objects
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            List of Question objects
        """
        print("Extracting text from PDF...")
        pages_text = self.extract_text_from_pdf(pdf_path)
        
        # Extract country
        full_text = " ".join(pages_text)
        country = self.extract_country_from_text(full_text)
        print(f"Detected country: {country}")
        
        questions = []
        
        for page_num, page_text in enumerate(pages_text):
            print(f"Processing page {page_num + 1}...")
            
            # Use Gemini to extract structured questions
            page_questions = self._extract_questions_from_page(page_text, country, page_num + 1)
            questions.extend(page_questions)
        
        # Remove duplicates
        unique_questions = self._remove_duplicate_questions(questions)
        print(f"Extracted {len(unique_questions)} unique questions")
        
        return unique_questions
    
    def _extract_questions_from_page(self, page_text: str, country: str, page_num: int) -> List[Question]:
        """Extract questions from a single page"""
        prompt = f"""
        Extract NCA questionnaire questions from the following text. 
        DO NOT include responses (Yes/No answers).
        
        For each question, determine:
        1. Question text
        2. Question type (yes_no, text, date, selection, numeric)
        3. Category/section
        4. If it's required
        5. Any options (for selection questions)
        
        Format as JSON array with this structure:
        [
            {{
                "text": "question text",
                "type": "yes_no|text|date|selection|numeric",
                "category": "category name",
                "required": true|false,
                "options": ["option1", "option2"] or null,
                "help_text": "additional context"
            }}
        ]
        
        Text: {page_text}
        """
        
        try:
            response = self.model.generate_content(prompt)
            
            # Try to parse JSON response
            try:
                questions_data = json.loads(response.text)
            except json.JSONDecodeError:
                # Fallback to manual parsing
                questions_data = self._manual_question_parsing(page_text)
            
            questions = []
            for q_data in questions_data:
                question = Question(
                    id=self._generate_question_id(q_data['text'], country),
                    text=q_data['text'],
                    type=QuestionType(q_data.get('type', 'text')),
                    category=q_data.get('category', 'General'),
                    country=country,
                    required=q_data.get('required', True),
                    options=q_data.get('options'),
                    help_text=q_data.get('help_text', ''),
                    regulatory_context=self._extract_regulatory_context(q_data['text']),
                    compliance_area=self._identify_compliance_area(q_data['text'])
                )
                questions.append(question)
            
            return questions
            
        except Exception as e:
            print(f"Error extracting questions: {e}")
            return []
    
    def _manual_question_parsing(self, text: str) -> List[Dict]:
        """Fallback manual parsing when JSON parsing fails"""
        questions = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if self._is_question_line(line):
                question_type = self._infer_question_type(line)
                questions.append({
                    'text': line,
                    'type': question_type,
                    'category': self._categorize_question(line),
                    'required': True,
                    'options': self._extract_options(line),
                    'help_text': ''
                })
        
        return questions
    
    def _is_question_line(self, line: str) -> bool:
        """Determine if a line contains a question"""
        question_indicators = [
            '?', 'Please', 'Was', 'Were', 'Does', 'Is', 'Date', 'Document',
            'Client', 'Site', 'Rationale', 'The entity', 'The annual',
            'confirm', 'select', 'identify', 'provide', 'performed'
        ]
        
        return (any(indicator in line for indicator in question_indicators) 
                and len(line) > 10 
                and not line.lower() in ['yes', 'no', 'test', 'test-director'])
    
    def _infer_question_type(self, question: str) -> str:
        """Infer question type from text"""
        question_lower = question.lower()
        
        if '?' in question and ('yes' in question_lower or 'no' in question_lower or 'was' in question_lower or 'were' in question_lower or 'does' in question_lower or 'is' in question_lower):
            return 'yes_no'
        elif 'date' in question_lower:
            return 'date'
        elif 'select' in question_lower or 'choose' in question_lower:
            return 'selection'
        elif 'number' in question_lower or 'amount' in question_lower:
            return 'numeric'
        else:
            return 'text'
    
    def _extract_options(self, question: str) -> Optional[List[str]]:
        """Extract options for selection questions"""
        # This is a simplified implementation - you might need more sophisticated parsing
        if 'select' in question.lower():
            return ['Option 1', 'Option 2', 'Option 3']  # Placeholder
        return None
    
    def _generate_question_id(self, question: str, country: str) -> str:
        """Generate unique ID for question"""
        content = f"{question}_{country}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _categorize_question(self, question: str) -> str:
        """Categorize question based on content"""
        question_lower = question.lower()
        
        categories = {
            'Target Market Assessment': ['target market', 'assessment', 'sales force'],
            'Site Visitation': ['site visit', 'physical', 'business operating address'],
            'Business Operations': ['business', 'trading', 'operations', 'revenue'],
            'Entity Structure': ['entity', 'ownership', 'shareholders', 'beneficial'],
            'Staffing': ['employee', 'staff', 'personnel'],
            'Compliance': ['compliance', 'regulatory', 'cii account', 'relationship'],
            'Financial': ['financial', 'revenue', 'sales', 'l2group'],
            'Documentation': ['document', 'provide', 'evidence']
        }
        
        for category, keywords in categories.items():
            if any(keyword in question_lower for keyword in keywords):
                return category
        
        return 'General'
    
    def _extract_regulatory_context(self, question: str) -> str:
        """Extract regulatory context from question"""
        regulatory_terms = [
            'CII account', 'L2group', 'beneficial owner', 'CSSP', 'SOEID',
            'compliance', 'regulatory', 'assessment', 'due diligence'
        ]
        
        found_terms = [term for term in regulatory_terms if term.lower() in question.lower()]
        return ', '.join(found_terms) if found_terms else 'General'
    
    def _identify_compliance_area(self, question: str) -> str:
        """Identify compliance area"""
        compliance_areas = {
            'KYC': ['know your customer', 'client', 'customer', 'identity'],
            'AML': ['anti money laundering', 'suspicious', 'transaction'],
            'CDD': ['customer due diligence', 'beneficial owner', 'ownership'],
            'Operational': ['site visit', 'physical', 'operations', 'staff'],
            'Financial': ['revenue', 'sales', 'trading', 'financial']
        }
        
        question_lower = question.lower()
        for area, keywords in compliance_areas.items():
            if any(keyword in question_lower for keyword in keywords):
                return area
        
        return 'General'
    
    def _remove_duplicate_questions(self, questions: List[Question]) -> List[Question]:
        """Remove duplicate questions"""
        seen = set()
        unique_questions = []
        
        for q in questions:
            if q.text not in seen:
                seen.add(q.text)
                unique_questions.append(q)
        
        return unique_questions
    
    def save_questions_to_db(self, questions: List[Question]):
        """Save questions to vector database"""
        try:
            documents = []
            metadatas = []
            ids = []
            
            for question in questions:
                documents.append(question.text)
                metadatas.append({
                    'country': question.country,
                    'category': question.category,
                    'type': question.type.value,
                    'required': question.required,
                    'options': json.dumps(question.options) if question.options else None,
                    'help_text': question.help_text,
                    'regulatory_context': question.regulatory_context,
                    'compliance_area': question.compliance_area,
                    'timestamp': datetime.now().isoformat()
                })
                ids.append(question.id)
            
            self.questions_collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
            print(f"Saved {len(questions)} questions to database")
            
        except Exception as e:
            print(f"Error saving questions: {e}")
    
    def upload_questionnaire(self, pdf_path: str) -> Dict[str, Any]:
        """
        Main method to upload questionnaire from PDF
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Summary of uploaded questionnaire
        """
        questions = self.extract_questions_from_pdf(pdf_path)
        
        if questions:
            self.save_questions_to_db(questions)
            
            # Create summary
            country = questions[0].country
            categories = {}
            for q in questions:
                categories[q.category] = categories.get(q.category, 0) + 1
            
            return {
                'success': True,
                'country': country,
                'total_questions': len(questions),
                'categories': categories,
                'message': f'Successfully uploaded {len(questions)} questions for {country}'
            }
        else:
            return {
                'success': False,
                'message': 'No questions could be extracted from the PDF'
            }
    
    # =================== CASE 2: INTERACTIVE CHATBOT ===================
    
    def get_countries(self) -> List[str]:
        """Get list of available countries"""
        return self.countries
    
    def get_questions_for_country(self, country: str) -> List[Question]:
        """Get all questions for a specific country"""
        try:
            results = self.questions_collection.query(
                query_texts=[f"questions for {country}"],
                where={"country": country},
                n_results=1000  # Get all questions
            )
            
            questions = []
            if results['documents']:
                for i, doc in enumerate(results['documents'][0]):
                    metadata = results['metadatas'][0][i]
                    question = Question(
                        id=results['ids'][0][i],
                        text=doc,
                        type=QuestionType(metadata['type']),
                        category=metadata['category'],
                        country=metadata['country'],
                        required=metadata['required'],
                        options=json.loads(metadata['options']) if metadata['options'] else None,
                        help_text=metadata['help_text'],
                        regulatory_context=metadata['regulatory_context'],
                        compliance_area=metadata['compliance_area']
                    )
                    questions.append(question)
            
            return questions
            
        except Exception as e:
            print(f"Error getting questions for country: {e}")
            return []
    
    def get_questions_by_category(self, country: str, category: str) -> List[Question]:
        """Get questions by category for a specific country"""
        try:
            results = self.questions_collection.query(
                query_texts=[f"{category} questions for {country}"],
                where={"country": country, "category": category},
                n_results=100
            )
            
            questions = []
            if results['documents']:
                for i, doc in enumerate(results['documents'][0]):
                    metadata = results['metadatas'][0][i]
                    question = Question(
                        id=results['ids'][0][i],
                        text=doc,
                        type=QuestionType(metadata['type']),
                        category=metadata['category'],
                        country=metadata['country'],
                        required=metadata['required'],
                        options=json.loads(metadata['options']) if metadata['options'] else None,
                        help_text=metadata['help_text'],
                        regulatory_context=metadata['regulatory_context'],
                        compliance_area=metadata['compliance_area']
                    )
                    questions.append(question)
            
            return questions
            
        except Exception as e:
            print(f"Error getting questions by category: {e}")
            return []
    
    def save_user_response(self, user_id: str, question_id: str, answer: Any, session_id: str = None):
        """Save user response to database"""
        try:
            response = UserResponse(
                question_id=question_id,
                answer=answer,
                timestamp=datetime.now().isoformat()
            )
            
            response_id = f"{user_id}_{question_id}_{session_id or 'default'}"
            
            self.responses_collection.add(
                documents=[str(answer)],
                metadatas=[{
                    'user_id': user_id,
                    'question_id': question_id,
                    'answer': str(answer),
                    'session_id': session_id or 'default',
                    'timestamp': response.timestamp
                }],
                ids=[response_id]
            )
            
        except Exception as e:
            print(f"Error saving response: {e}")
    
    def get_user_responses(self, user_id: str, session_id: str = None) -> Dict[str, Any]:
        """Get all responses for a user session"""
        try:
            where_clause = {'user_id': user_id}
            if session_id:
                where_clause['session_id'] = session_id
            
            results = self.responses_collection.query(
                query_texts=[f"responses for {user_id}"],
                where=where_clause,
                n_results=1000
            )
            
            responses = {}
            if results['metadatas']:
                for metadata in results['metadatas'][0]:
                    responses[metadata['question_id']] = {
                        'answer': metadata['answer'],
                        'timestamp': metadata['timestamp']
                    }
            
            return responses
            
        except Exception as e:
            print(f"Error getting user responses: {e}")
            return {}
    
    def generate_completion_report(self, user_id: str, country: str, session_id: str = None) -> Dict[str, Any]:
        """Generate completion report for user"""
        questions = self.get_questions_for_country(country)
        responses = self.get_user_responses(user_id, session_id)
        
        total_questions = len(questions)
        answered_questions = len(responses)
        completion_rate = (answered_questions / total_questions * 100) if total_questions > 0 else 0
        
        # Category breakdown
        category_stats = {}
        for question in questions:
            category = question.category
            if category not in category_stats:
                category_stats[category] = {'total': 0, 'answered': 0}
            category_stats[category]['total'] += 1
            if question.id in responses:
                category_stats[category]['answered'] += 1
        
        # Calculate category completion rates
        for category, stats in category_stats.items():
            stats['completion_rate'] = (stats['answered'] / stats['total'] * 100) if stats['total'] > 0 else 0
        
        return {
            'country': country,
            'total_questions': total_questions,
            'answered_questions': answered_questions,
            'completion_rate': completion_rate,
            'category_stats': category_stats,
            'missing_questions': [q.id for q in questions if q.id not in responses]
        }

class NCAQuestionnaireBot:
    """Interactive chatbot for NCA questionnaires"""
    
    def __init__(self, system: NCAQuestionnaireSystem):
        self.system = system
        self.current_session = {}
    
    def start_session(self, user_id: str, country: str = None, session_id: str = None) -> Dict[str, Any]:
        """Start a new questionnaire session"""
        if not session_id:
            session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        self.current_session = {
            'user_id': user_id,
            'country': country,
            'session_id': session_id,
            'current_question_index': 0,
            'questions': [],
            'responses': {}
        }
        
        if country:
            self.current_session['questions'] = self.system.get_questions_for_country(country)
        
        return {
            'session_id': session_id,
            'message': f"Welcome to the NCA Questionnaire Bot! {'Country set to ' + country if country else 'Please select a country to begin.'}",
            'countries': self.system.get_countries() if not country else None,
            'total_questions': len(self.current_session['questions']) if country else 0
        }
    
    def select_country(self, country: str) -> Dict[str, Any]:
        """Select country for questionnaire"""
        if country not in self.system.get_countries():
            return {
                'success': False,
                'message': f"Country '{country}' not supported. Available countries: {', '.join(self.system.get_countries())}"
            }
        
        self.current_session['country'] = country
        self.current_session['questions'] = self.system.get_questions_for_country(country)
        
        return {
            'success': True,
            'message': f"Country set to {country}. Found {len(self.current_session['questions'])} questions.",
            'total_questions': len(self.current_session['questions'])
        }
    
    def get_next_question(self) -> Dict[str, Any]:
        """Get the next question for the user"""
        if not self.current_session.get('questions'):
            return {
                'success': False,
                'message': "No questions available. Please select a country first."
            }
        
        questions = self.current_session['questions']
        current_index = self.current_session['current_question_index']
        
        if current_index >= len(questions):
            return {
                'success': False,
                'message': "All questions completed!",
                'completed': True,
                'completion_report': self.system.generate_completion_report(
                    self.current_session['user_id'],
                    self.current_session['country'],
                    self.current_session['session_id']
                )
            }
        
        question = questions[current_index]
        
        return {
            'success': True,
            'question': {
                'id': question.id,
                'text': question.text,
                'type': question.type.value,
                'category': question.category,
                'required': question.required,
                'options': question.options,
                'help_text': question.help_text
            },
            'progress': {
                'current': current_index + 1,
                'total': len(questions),
                'percentage': ((current_index + 1) / len(questions)) * 100
            }
        }
    
    def submit_answer(self, answer: Any) -> Dict[str, Any]:
        """Submit answer for current question"""
        if not self.current_session.get('questions'):
            return {
                'success': False,
                'message': "No active session. Please start a session first."
            }
        
        questions = self.current_session['questions']
        current_index = self.current_session['current_question_index']
        
        if current_index >= len(questions):
            return {
                'success': False,
                'message': "No more questions to answer."
            }
        
        question = questions[current_index]
        
        # Validate answer based on question type
        validation_result = self._validate_answer(question, answer)
        if not validation_result['valid']:
            return {
                'success': False,
                'message': validation_result['message']
            }
        
        # Save response
        self.system.save_user_response(
            self.current_session['user_id'],
            question.id,
            answer,
            self.current_session['session_id']
        )
        
        # Update session
        self.current_session['responses'][question.id] = answer
        self.current_session['current_question_index'] += 1
        
        return {
            'success': True,
            'message': "Answer saved successfully!",
            'next_question': self.get_next_question()
        }
    
    def _validate_answer(self, question: Question, answer: Any) -> Dict[str, Any]:
        """Validate answer based on question type"""
        if question.required and (answer is None or answer == ""):
            return {
                'valid': False,
                'message': "This question is required. Please provide an answer."
            }
        
        if question.type == QuestionType.YES_NO:
            if str(answer).lower() not in ['yes', 'no', 'y', 'n', 'true', 'false']:
                return {
                    'valid': False,
                    'message': "Please answer with Yes or No."
                }
        
        elif question.type == QuestionType.DATE:
            try:
                datetime.strptime(str(answer), '%Y-%m-%d')
            except ValueError:
                return {
                    'valid': False,
                    'message': "Please provide date in YYYY-MM-DD format."
                }
        
        elif question.type == QuestionType.SELECTION:
            if question.options and answer not in question.options:
                return {
                    'valid': False,
                    'message': f"Please select from: {', '.join(question.options)}"
                }
        
        elif question.type == QuestionType.NUMERIC:
            try:
                float(answer)
            except ValueError:
                return {
                    'valid': False,
                    'message': "Please provide a numeric value."
                }
        
        return {'valid': True}
    
    def get_progress(self) -> Dict[str, Any]:
        """Get current progress"""
        if not self.current_session.get('questions'):
            return {
                'success': False,
                'message': "No active session."
            }
        
        return self.system.generate_completion_report(
            self.current_session['user_id'],
            self.current_session['country'],
            self.current_session['session_id']
        )
    
    def skip_question(self) -> Dict[str, Any]:
        """Skip current question (if not required)"""
        if not self.current_session.get('questions'):
            return {
                'success': False,
                'message': "No active session."
            }
        
        questions = self.current_session['questions']
        current_index = self.current_session['current_question_index']
        
        if current_index >= len(questions):
            return {
                'success': False,
                'message': "No more questions to skip."
            }
        
        question = questions[current_index]
        
        if question.required:
            return {
                'success': False,
                'message': "This question is required and cannot be skipped."
            }
        
        self.current_session['current_question_index'] += 1
        
        return {
            'success': True,
            'message': "Question skipped.",
            'next_question': self.get_next_question()
        }

# Example usage
def main():
    # Initialize system
    system = NCAQuestionnaireSystem(
        gemini_api_key="YOUR_GEMINI_API_KEY",
        db_path="./nca_system_db"
    )
    
    # CASE 1: Upload questionnaire from PDF
    print("=== CASE 1: Upload Questionnaire ===")
    result = system.upload_questionnaire("your_document.pdf")
    print(json.dumps(result, indent=2))
    
    # CASE 2: Interactive chatbot
    print("\n=== CASE 2: Interactive Chatbot ===")
    bot = NCAQuestionnaireBot(system)
    
    # Start session
    session = bot.start_session(user_id="user123", country="United Arab Emirates")
    print("Session started:", session)
    
    # Get first question
    question = bot.get_next_question()
    print("First question:", question)
    
    # Submit answer
    answer_result = bot.submit_answer("Yes")
    print("Answer submitted:", answer_result)
    
    # Get progress
    progress = bot.get_progress()
    print("Progress:", progress)

if __name__ == "__main__":
    main()
