// src/RateLimitSearch.jsx 
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { rateLimitData } from './rateLimitData';

// --- NEW COMPONENT: CopyButton ---
const CopyButton = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    // Stop the event from bubbling up to the parent div's onClick (handleEndpointClick)
    e.stopPropagation(); 
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`ml-2 text-xs py-1 px-2 rounded transition duration-150 flex items-center
        ${copied
          ? 'bg-green-600 text-white'
          : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
        }`}
      title="Copy Path Pattern"
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 13.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
          <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
        </svg>
      )}
      {copied ? 'Copied!' : 'Copy Path'}
    </button>
  );
};

// --- NEW COMPONENT: AlertTriangle Icon ---
const AlertTriangle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.364 2.765-1.364 3.53 0l7.228 12.836c.765 1.364-.2 3.065-1.765 3.065H2.794c-1.565 0-2.53-1.701-1.765-3.065l7.228-12.836zM10 15a1 1 0 100-2 1 1 0 000 2zm0-4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
);


// --- DetailRow Component (Modified for Refined Labels) ---
const DetailRow = ({ label, value }) => {
    // Refine 'Notes' label to 'Request Context'
    const displayLabel = label === 'Notes' ? 'Request Context' : label;
    // Apply special styling for Endpoint Type
    const displayValue = label === 'Endpoint Type' ? <code className="bg-gray-700 p-0.5 rounded text-sm">{value}</code> : value;
    
    return (
        <div className="flex justify-between py-1 border-b border-gray-700 text-sm">
            <span className="font-medium text-gray-400">{displayLabel}:</span>
            <span className="font-mono text-sm text-blue-300 bg-gray-800 px-1 rounded break-all">
                {displayValue}
            </span>
        </div>
    );
};

// --- FilterDropdown Component (Unchanged) ---
const FilterDropdown = ({ label, value, options, onChange, disabled = false }) => (
    <div className="flex flex-col">
        <label className="text-xs font-medium mb-1 text-gray-400">{label}</label>
        <select
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`w-full p-2 text-sm bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-lg transition duration-150 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <option value="">All {label}</option>
            {options.map((option, index) => (
                <option key={index} value={option}>
                    {option}
                </option>
            ))}
        </select>
    </div>
);


const RateLimitSearch = () => {
  // Auth0 Hooks
  const { isAuthenticated, loginWithRedirect, logout, getAccessTokenSilently, isLoading } = useAuth0();

  // --- Filter and UI States ---
  const [searchTerm, setSearchTerm] = useState('');
  // selectedEndpoint can be set via search result (if unique) OR by clicking a card
  const [selectedEndpoint, setSelectedEndpoint] = useState(null); 
  
  // NEW API FILTER STATE
  const [selectedAPI, setSelectedAPI] = useState(''); 
  
  const [selectedEndpointType, setSelectedEndpointType] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeoutRef = useRef(null);

  const [apiSubscriptionType, setApiSubscriptionType] = useState('');
  const [manualSubscriptionType, setManualSubscriptionType] = useState('');
  const [isTenantFilterDisabled, setIsTenantFilterDisabled] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('idle');

  // 櫨 NEW STATE FOR KEYBOARD NAVIGATION
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // --- USAGE MONITORING STATES ---
  const [usageData, setUsageData] = useState(null);
  const [usageFetchStatus, setUsageFetchStatus] = useState('idle');
  // ----------------------------------------

  const effectiveSubscriptionType = isTenantFilterDisabled
    ? manualSubscriptionType
    : (isAuthenticated ? apiSubscriptionType : manualSubscriptionType);


  // --- AUTH0 DATA FETCH EFFECT ---
  useEffect(() => {
    if (isAuthenticated) {
        const getUserSubscription = async () => {
            setFetchStatus('loading');
            try {
              const accessToken = await getAccessTokenSilently();
              
              const response = await fetch('http://localhost:3001/api/user/subscription', { 
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              
              if (!response.ok) throw new Error('API failed to return subscription data.');
    
              const data = await response.json();
              
              setApiSubscriptionType(data.subscriptionType); 
              setFetchStatus('success');
              
            } catch (error) {
              console.error("Error fetching subscription type:", error);
              setApiSubscriptionType('Free'); 
              setFetchStatus('error');
            }
          };
    
          getUserSubscription();
    } else {
        setApiSubscriptionType('');
        setManualSubscriptionType('');
        setSelectedAPI(''); 
        setSelectedEndpointType('');
        setSelectedMethod('');
        setIsTenantFilterDisabled(false);
        setFetchStatus('idle');
    }
  }, [isAuthenticated, getAccessTokenSilently]);


  // --- Helper to get unique options and filter data ---
  const uniqueOptions = useMemo(() => {
    // 1. Filter data based on effectiveSubscriptionType
    let filteredData = effectiveSubscriptionType
        ? rateLimitData.filter(item => item.SubscriptionType === effectiveSubscriptionType)
        : rateLimitData;

    // 2. Further filter data by selectedAPI
    const apiFilteredData = selectedAPI
        ? filteredData.filter(item => item.API === selectedAPI)
        : filteredData;

    // 3. Further filter data by selectedEndpointType
    const endpointFilteredData = selectedEndpointType
        ? apiFilteredData.filter(item => item.EndpointType === selectedEndpointType)
        : apiFilteredData;

    // --- Collect Options ---
    const tenants = new Set();
    const apis = new Set(); 
    const endpoints = new Set();
    const methods = new Set();

    // Tenants (Subscription Types) are always collected from the FULL list
    rateLimitData.forEach(item => {
        if (item.SubscriptionType && item.SubscriptionType !== 'N/A') {
            tenants.add(item.SubscriptionType);
        }
    });
    
    // APIs are collected from the subscription-filtered data
    filteredData.forEach(item => {
        if (item.API && item.API !== 'N/A') {
            apis.add(item.API);
        }
    });

    // Endpoints are collected from the subscription AND API-filtered data
    apiFilteredData.forEach(item => {
        if (item.EndpointType && item.EndpointType !== 'N/A') {
            endpoints.add(item.EndpointType);
        }
    });

    // Methods are collected ONLY from the data filtered by ALL three: subscription, API, and endpoint
    endpointFilteredData.forEach(item => {
        if (item.Method && item.Method !== 'N/A') {
            item.Method.split(',').forEach(m => {
                methods.add(m.trim());
            });
        }
    });

    return {
      tenants: Array.from(tenants).sort(),
      apis: Array.from(apis).sort(), 
      endpoints: Array.from(endpoints).sort(),
      methods: Array.from(methods).sort(),
      fullData: filteredData, 
      apiFilteredData: filteredData, 
      endpointFilteredData: endpointFilteredData,
    };
  }, [effectiveSubscriptionType, selectedAPI, selectedEndpointType]); 


  // --- NEW EFFECT FOR USAGE DASHBOARD (MOCK API CALL) ---
  const fetchMockUsage = useCallback((endpoint) => {
    // Calculate a random usage number based on the burst limit
    const limit = parseInt(endpoint.SustainedLimit) || 10;
    // Simulate current usage as a random number up to the limit
    const currentUsage = Math.floor(Math.random() * (limit + 1));

    setUsageData({
        currentUsage,
        limit,
        limitUnit: endpoint.SustainedLimitUnits,
        resetTime: new Date(Date.now() + 60000).toLocaleTimeString(), // 1 minute from now
        method: endpoint.Method.split(',')[0].trim() // Use the first method for the mock
    });
    setUsageFetchStatus('success');
  }, []);

  useEffect(() => {
    setUsageData(null); // Clear old usage data on new selection

    if (isAuthenticated && selectedEndpoint) {
        setUsageFetchStatus('loading');

        // 1. Initial Fetch
        const initialFetchTimeout = setTimeout(() => {
            fetchMockUsage(selectedEndpoint);
        }, 500);

        // 2. Set up Polling
        const pollingInterval = setInterval(() => {
            fetchMockUsage(selectedEndpoint);
        }, 10000);

        // 3. Cleanup
        return () => {
            clearTimeout(initialFetchTimeout);
            clearInterval(pollingInterval);
            setUsageFetchStatus('idle');
        };
    } else if (isAuthenticated) {
        setUsageFetchStatus('idle');
    }

  }, [isAuthenticated, selectedEndpoint, fetchMockUsage]);
  // -------------------------------------------------------------

  // --- Path Suggestions Logic ---
  const suggestedPaths = useMemo(() => {
    const paths = new Set();
    // Use subscription-filtered data for suggestions
    uniqueOptions.fullData.forEach(item => { 
      if (item.Path && item.Path !== 'N/A') {
        paths.add(item.Path);
      }
    });
    return Array.from(paths);
  }, [uniqueOptions.fullData]);


  // --- Filtering Logic for Final Results (MODIFIED) ---
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

  const suggestions = useMemo(() => {
    if (!normalizedSearchTerm) return [];
    return suggestedPaths.filter(path => path.toLowerCase().includes(normalizedSearchTerm)).slice(0, 5);
  }, [normalizedSearchTerm, suggestedPaths]);

  const results = useMemo(() => {
    // Start with subscription-filtered data
    let filteredData = uniqueOptions.fullData; 

    // If there is a search term, ONLY filter by search term, ignoring dropdowns.
    if (normalizedSearchTerm) {
        filteredData = filteredData.filter(
          (item) =>
            item.Path.toLowerCase().includes(normalizedSearchTerm) ||
            item.EndpointType.toLowerCase().includes(normalizedSearchTerm) ||
            item.API.toLowerCase().includes(normalizedSearchTerm)
        );
    } else {
        // If NO search term, apply the dropdown filters.
        if (selectedAPI) {
            filteredData = filteredData.filter(item => item.API === selectedAPI);
        }

        if (selectedEndpointType) {
            filteredData = filteredData.filter(item => item.EndpointType === selectedEndpointType);
        }

        if (selectedMethod) {
            filteredData = filteredData.filter(item =>
                item.Method.split(',').map(m => m.trim()).includes(selectedMethod)
            );
        }
    }

    return filteredData;
  }, [normalizedSearchTerm, uniqueOptions.fullData, selectedAPI, selectedEndpointType, selectedMethod]); 


  // --- Set selectedEndpoint from Dropdowns OR Search Results ---
  useEffect(() => {
      // 1. Check if the user has filtered down to a single, unique result.
      // This allows immediate usage view on a perfect search match or tight filter.
      if (normalizedSearchTerm && results.length === 1) {
          setSelectedEndpoint(results[0]);
      } else if (normalizedSearchTerm && results.length > 1) {
          // If the search yields multiple results, clear selection to force a click.
          setSelectedEndpoint(null);
      } else if (!normalizedSearchTerm && results.length === 1) {
          // If filtering yields one result, auto-select it.
          setSelectedEndpoint(results[0]);
      } else if (!normalizedSearchTerm && results.length !== 1) {
          // If filters are loose or clear, clear selection.
          setSelectedEndpoint(null);
      }
      
  }, [results, normalizedSearchTerm]); 


  // --- Grouping Logic for Final Results ---
  const groupedResults = useMemo(() => {
    return results.reduce((acc, item) => {
      const apiGroup = item.API;
      if (!acc[apiGroup]) {
        acc[apiGroup] = [];
      }
      acc[apiGroup].push(item);
      return acc;
    }, {});
  }, [results]);


  // --- Effect to clear dependent filters when a broader filter changes ---
  useEffect(() => {
      // Clear Endpoint Type and Method when API changes
      setSelectedEndpointType('');
      setSelectedMethod('');
      setSelectedEndpoint(null); 
      setSearchTerm(''); // Clear search to switch back to filter-based view
  }, [selectedAPI]); 

  useEffect(() => {
      // Clear Method when Endpoint Type changes
      setSelectedMethod('');
      setSelectedEndpoint(null); 
      setSearchTerm(''); // Clear search to switch back to filter-based view
  }, [selectedEndpointType]); 


  // --- Event Handlers (MODIFIED for search fix) ---
  const handleSelectSuggestion = (path) => {
    if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
    }
    setSearchTerm(path);
    const exactMatch = uniqueOptions.fullData.find(item => item.Path === path);
    // Setting selectedEndpoint here ensures usage data appears immediately on selection
    setSelectedEndpoint(exactMatch || null); 
    setShowSuggestions(false);
    setHighlightedIndex(-1); // Reset highlight on selection
    
    // Set dependent filters on selection
    if (exactMatch) {
        setSelectedAPI(exactMatch.API || '');
        setSelectedEndpointType(exactMatch.EndpointType || '');
    }
  };

  const handleSearch = (e) => {
    // 櫨 MODIFIED: Add keyboard navigation logic
    if (e.key === 'Enter') {
      if (highlightedIndex !== -1 && suggestions.length > 0) {
        e.preventDefault(); // Prevent form submission if in a form
        handleSelectSuggestion(suggestions[highlightedIndex]);
      } else {
        // The results effect will handle setting selectedEndpoint if only one result is left.
        setShowSuggestions(false);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex(prevIndex => (prevIndex + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex(prevIndex => (prevIndex - 1 + suggestions.length) % suggestions.length);
      }
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setHighlightedIndex(-1); // Reset highlight when typing
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
        setShowSuggestions(false);
        setHighlightedIndex(-1); // Also reset highlight on blur
    }, 150);
  };

  // 櫨 NEW: Mouse Enter handler for visual highlighting
  const handleMouseEnter = (index) => {
    if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
    }
    setHighlightedIndex(index);
  }

  // --- NEW: Handler to select/deselect an endpoint from the results list ---
  const handleEndpointClick = (endpoint) => {
      // Toggle selection: if it's already selected, deselect it. Otherwise, select it.
      setSelectedEndpoint(prev => prev === endpoint ? null : endpoint);
  };

  // Grouped results display logic
  const displayedGroupedResults = groupedResults;

  // --- UI Helpers for Auth0 Status (Unchanged) ---
  const renderSubscriptionStatus = () => {
      if (isLoading) return <span className="text-gray-400">Loading Auth0 state...</span>;
      if (fetchStatus === 'loading') return <span className="text-yellow-400">Fetching Subscription...</span>;
      if (fetchStatus === 'error') return <span className="text-red-400">Error fetching subscription. Defaulted to <span className='font-bold'>{apiSubscriptionType}</span>.</span>;

      return (
          <div className="flex flex-col items-end">
              <span className="text-blue-400 font-bold">
                  {apiSubscriptionType}
              </span>
              <div className="flex items-center mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                  <span className="text-xs text-gray-500 italic">
                      (Pulled from Tenant Information)
                  </span>
              </div>
          </div>
      );
  };

  const handleSubscriptionChange = (e) => {
      const value = e.target.value;
      setManualSubscriptionType(value);
      setSelectedAPI(''); 
      setSelectedEndpointType('');
      setSelectedMethod('');
      setSearchTerm('');
      setSelectedEndpoint(null);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
  };

  const renderSubscriptionFilter = () => {
      // --- Authenticated View ---
      if (isAuthenticated && apiSubscriptionType) {
          return (
              <div className="bg-[#171717] p-3 rounded-xl border border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-400">Subscription Status:</span>
                      {renderSubscriptionStatus()}
                  </div>

                  {/* Manual Override / Disable Checkbox */}
                  <div className="flex items-center justify-end pt-2 border-t border-gray-700/50">
                      <label className="text-xs font-medium text-gray-400 mr-2 cursor-pointer">
                          Override Tenant Filter
                      </label>
                      <input
                          type="checkbox"
                          checked={isTenantFilterDisabled}
                          onChange={(e) => {
                              setIsTenantFilterDisabled(e.target.checked);
                              if (!e.target.checked) {
                                  setManualSubscriptionType('');
                                  setSelectedAPI('');
                                  setSelectedEndpointType('');
                                  setSelectedMethod('');
                              }
                          }}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                  </div>
              </div>
          );
      }

      // --- Manual Selection View (For Unauthenticated or Loading/Error) ---
      return (
          <FilterDropdown
              label="Select Subscription Type"
              value={effectiveSubscriptionType}
              options={uniqueOptions.tenants}
              onChange={handleSubscriptionChange}
          />
      );
  };

  const renderManualDropdownIfDisabled = () => {
      if (isAuthenticated && isTenantFilterDisabled) {
          return (
              <div className="mt-4 max-w-4xl mx-auto">
                  <FilterDropdown
                      label="Select Custom Subscription Type"
                      value={manualSubscriptionType}
                      options={uniqueOptions.tenants}
                      onChange={handleSubscriptionChange}
                  />
              </div>
          );
      }
      return null;
  }

  const isFilterReady = !!effectiveSubscriptionType;
  const isAPIFilterReady = isFilterReady; 
  const isEndpointFilterReady = isAPIFilterReady && !!selectedAPI; 
  const isMethodFilterReady = isEndpointFilterReady && !!selectedEndpointType; 


  return (
    <div className="min-h-screen bg-[#202124] text-[#E8EAED] p-8 font-sans">
      <div className="flex justify-between items-center mb-8">
        {/* START: Header Section */}
        <div className="flex flex-col items-start">
            <h1 className="text-3xl font-normal text-white">
                Rate Limit Lookup
            </h1>

            <div className="text-xs text-gray-500 mt-1 flex items-center">
                <span>Powered by</span>
                <span className="w-2 h-2 rounded-full bg-orange-500 mx-1"></span>
                <a
                    href="https://auth0.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-500 transition duration-150"
                >
                    Auth0
                </a>
            </div>
        </div>
        {/* END: Header Section */}

        {/* Login/Logout Button */}
        <div>
            {isAuthenticated ? (
                <button
                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                    className="py-1.5 px-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition duration-150 text-sm"
                >
                    Log Out
                </button>
            ) : (
                <button
                    onClick={() => loginWithRedirect()}
                    className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition duration-150 text-sm"
                >
                    Log In
                </button>
            )}
        </div>
      </div>

      {/* --- Subscription Status / Manual Dropdown --- */}
      <div className="max-w-4xl mx-auto">
        {renderSubscriptionFilter()}
      </div>

      {/* --- Manual Override Dropdown --- */}
      {renderManualDropdownIfDisabled()}


      {/* --- API, Endpoint Type, and Method Filters --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6 max-w-4xl mx-auto">

        {/* NEW API Filter */}
        <FilterDropdown
            label="API Group"
            value={selectedAPI}
            options={uniqueOptions.apis}
            onChange={(e) => { setSelectedAPI(e.target.value); }}
            disabled={!isAPIFilterReady || !!normalizedSearchTerm} // Disable filters during active search
        />

        <FilterDropdown
            label="Endpoint Type"
            value={selectedEndpointType}
            options={uniqueOptions.endpoints}
            onChange={(e) => { setSelectedEndpointType(e.target.value); }}
            disabled={!isEndpointFilterReady || !!normalizedSearchTerm}
        />

        <FilterDropdown
            label="Method"
            value={selectedMethod}
            options={uniqueOptions.methods}
            onChange={(e) => { setSelectedMethod(e.target.value); }}
            disabled={!isMethodFilterReady || !!normalizedSearchTerm}
        />
      </div>

      {/* Search Input and Suggestions */}
      <div className="relative mb-8 max-w-4xl mx-auto">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleSearch}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={!isFilterReady}
          placeholder={!isFilterReady ? "Select a subscription or log in to search" : "Search by path or endpoint name..."}
          className="w-full p-3 text-lg font-mono border-2 border-gray-700 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Smart Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                // 櫨 MODIFIED: Apply highlighting based on state
                onMouseDown={() => handleSelectSuggestion(suggestion)}
                onMouseEnter={() => handleMouseEnter(index)}
                className={`p-3 text-sm font-mono cursor-pointer transition duration-150 ease-in-out
                  ${index === highlightedIndex
                    ? 'bg-blue-600 text-white' // Highlighted style
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Results Display (Grouped) */}
      <div className="max-w-4xl mx-auto">
        {results.length === 0 && (normalizedSearchTerm || isFilterReady) && (
          <p className="text-center text-xl text-red-400 mt-10">
            No rate limit data found matching the current criteria.
          </p>
        )}

        {Object.keys(displayedGroupedResults).sort().map(apiGroup => (
            <div key={apiGroup} className="mb-8">
                {/* Group Heading */}
                <h2 className="text-2xl font-semibold text-white mb-4 p-2 border-b-2 border-blue-500/50">
                    {apiGroup} API Limits
                </h2>

                {/* Iterate over items within the group */}
                {displayedGroupedResults[apiGroup].map((item, index) => {
                    
                    // --- Logic for 'High-Risk Limit' Cue ---
                    const sustainedLimitNum = parseInt(item.SustainedLimit);
                    const isPerSecond = item.SustainedLimitUnits === 'per second';
                    const isVeryLow = sustainedLimitNum < 5 && sustainedLimitNum >= 0;
                    const isHighRisk = isPerSecond || isVeryLow;
                    
                    // Check if the current item is the one selected for usage display
                    const isCurrentlySelected = selectedEndpoint && selectedEndpoint.Path === item.Path;

                    return (
                        <div
                            key={index}
                            // --- ADD onClick HANDLER HERE ---
                            onClick={() => handleEndpointClick(item)}
                            className={`bg-[#171717] p-4 mb-4 rounded-xl shadow-lg border-l-4 transition duration-150 cursor-pointer 
                                ${isCurrentlySelected ? 'ring-2 ring-blue-500 border-blue-500' : ''} 
                                ${isHighRisk ? 'border-red-500 hover:border-red-400' : 'border-blue-500/0 hover:border-blue-500'}`
                            }
                        >
                            <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
                                {/* Endpoint Type and High-Risk Tag */}
                                <h3 className="text-lg font-medium text-white flex items-center">
                                    {item.EndpointType}
                                    {isHighRisk && (
                                        <span className="ml-3 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-800 text-red-300 flex items-center">
                                            <AlertTriangle />
                                            High-Risk Limit
                                        </span>
                                    )}
                                </h3>
                                {/* Copy Button (with stopPropagation implemented) */}
                                <CopyButton textToCopy={item.Path} />
                            </div>


                            {/* --- USAGE DASHBOARD BLOCK --- */}
                            {/* Display usage if authenticated AND this specific item is the unique result (isCurrentlySelected) */}
                            {isAuthenticated && isCurrentlySelected && usageFetchStatus !== 'idle' && (
                                <div className="pb-3 mb-3 border-b border-gray-700">
                                    <h4 className="text-sm font-medium text-yellow-400 mb-2">
                                        {usageFetchStatus === 'loading' && (
                                            <span className="animate-pulse">Fetching Live Usage...</span>
                                        )}
                                        {usageFetchStatus === 'success' && usageData && (
                                            `Live Usage Monitoring (${usageData.method} Limit)`
                                        )}
                                        {usageFetchStatus === 'error' && (
                                            <span className="text-red-500">Error fetching usage data.</span>
                                        )}
                                    </h4>

                                    {usageFetchStatus === 'success' && usageData && (
                                        <>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium text-gray-400">Requests Consumed:</span>
                                                <span className="font-bold text-white">
                                                    {usageData.currentUsage} / {usageData.limit} {usageData.limitUnit}
                                                </span>
                                            </div>

                                            {/* Visual Progress Bar */}
                                            <div className="w-full bg-gray-700 rounded-full h-3">
                                                <div
                                                    className="h-3 rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${Math.min(100, (usageData.currentUsage / usageData.limit) * 100)}%`,
                                                        backgroundColor: (usageData.currentUsage / usageData.limit) > 0.8
                                                            ? '#DC2626'
                                                            : (usageData.currentUsage / usageData.limit) > 0.5
                                                                ? '#F59E0B'
                                                                : '#2563EB'
                                                    }}
                                                ></div>
                                            </div>

                                            <p className="text-xs text-gray-500 mt-1.5 italic text-right">
                                                Next Refill: {usageData.resetTime} ({item.SustainedLimitUnits})
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                            {/* --- END USAGE DASHBOARD BLOCK --- */}


                            <div className="space-y-1">
                              <DetailRow label="API Type" value={item.API} />
                              <DetailRow label="Subscription Type" value={item.SubscriptionType} />
                              <DetailRow label="Path" value={item.Path} />
                              <DetailRow label="Method(s)" value={item.Method} />
                              <DetailRow label="Burst Limit" value={item.BurstLimit} />
                              <DetailRow
                                label="Sustained Limit"
                                value={`${item.SustainedLimit} ${item.SustainedLimitUnits}`}
                              />
                              <DetailRow label="Notes" value={item.Notes} /> 
                            </div>
                        </div>
                    );
                })}
            </div>
        ))}


        {!normalizedSearchTerm && !isFilterReady && !selectedEndpointType && !selectedMethod && (
          <p className="text-center text-sm text-gray-400 mt-10">
            Log in to see your rate limits, or select a Subscription Type to test.
          </p>
        )}
      </div>
    </div>
  );
};

export default RateLimitSearch;