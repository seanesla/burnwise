/**
 * OnboardingChat - Conversational farm setup using OpenAI Agents SDK
 * Replaces traditional form with natural language interface
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './OnboardingChat.css';

const OnboardingChat = () => {
  const navigate = useNavigate();
  const { user, completeOnboarding } = useAuth();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start conversation on mount
  useEffect(() => {
    startConversation();
  }, []);

  const startConversation = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post('/api/onboarding/start');
      
      if (response.data.success) {
        setSessionId(response.data.sessionId);
        setMessages([
          {
            role: 'assistant',
            content: response.data.message,
            timestamp: new Date()
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to start onboarding:', error);
      setMessages([
        {
          role: 'assistant',
          content: 'The onboarding service is temporarily unavailable. Please refresh the page and try again in a moment.',
          timestamp: new Date(),
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading || !sessionId) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message to chat
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    setIsLoading(true);

    try {
      const response = await axios.post('/api/onboarding/message', {
        message: userMessage,
        sessionId
      });

      if (response.data.success) {
        // Add assistant response
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.message,
          timestamp: new Date()
        }]);

        // Check if onboarding is completed
        if (response.data.completed) {
          setIsCompleted(true);
          handleCompletion();
        }
      } else {
        throw new Error(response.data.error || 'Failed to process message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I encountered an error. Could you please repeat that?',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleCompletion = () => {
    // Mark onboarding as complete
    completeOnboarding({
      method: 'conversational',
      completedAt: new Date()
    });

    // Show success message
    setMessages(prev => [...prev, {
      role: 'system',
      content: 'Great! Your farm is all set up. Redirecting to your dashboard...',
      timestamp: new Date()
    }]);

    // Redirect to spatial interface after delay
    setTimeout(() => {
      navigate('/spatial');
    }, 2000);
  };

  return (
    <div className="onboarding-chat-container">
      <div className="onboarding-chat">
        <div className="chat-header">
          <h2>Farm Setup Assistant</h2>
          <p>Let's get your farm registered with Burnwise</p>
        </div>

        <div className="chat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.role} ${message.isError ? 'error' : ''}`}
            >
              <div className="message-content">
                {message.content}
              </div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {!isCompleted && (
          <form onSubmit={sendMessage} className="chat-input-form">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className="chat-input"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="send-button"
              disabled={isLoading || !inputMessage.trim()}
            >
              Send
            </button>
          </form>
        )}

      </div>

      {/* Quick tips sidebar */}
      <div className="onboarding-tips">
        <h3>Quick Tips</h3>
        <ul>
          <li>You can provide multiple pieces of information at once</li>
          <li>Example: "My farm is Green Valley Farm, 250 acres near Sacramento"</li>
          <li>The assistant will ask for any missing information</li>
          <li>Your data is saved automatically as you go</li>
          <li>This is the only way to set up your farm - no forms needed</li>
        </ul>
      </div>
    </div>
  );
};

export default OnboardingChat;