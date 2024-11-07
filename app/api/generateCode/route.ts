import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { z } from "zod";
import shadcnDocs from "@/utils/shadcn-docs";
import dedent from "dedent";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(req: Request) {
  let json = await req.json();
  let result = z
    .object({
      shadcn: z.boolean().default(false),
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        }),
      ),
    })
    .safeParse(json);

  if (result.error) {
    return new Response(result.error.message, { status: 422 });
  }

  const { messages, shadcn } = result.data;
  const systemPrompt = getSystemPrompt(shadcn);

  try {
    // Get the model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Create chat
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        } as Content,
      ],
    });

    // Convert messages to Gemini format and add them to history
    const geminiMessages = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [
        {
          text:
            msg.role === "user"
              ? msg.content +
                " in less than 150 lines of code please only return code no text nothing just code  " +
                "\nPlease ONLY return code, NO backticks or language names."
              : msg.content,
        },
      ],
    })) as Content[];

    // Get streaming response
    const result = await chat.sendMessageStream([
      { text: geminiMessages[geminiMessages.length - 1].parts[0].text },
    ]);

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: new Headers({
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
      }),
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate response" }),
      { status: 500 },
    );
  }
}

function getSystemPrompt(shadcn: boolean) {
  let systemPrompt = `
    You are an expert frontend React engineer who is also a great UI/UX designer. Follow the instructions carefully:

    - Think carefully step by step.
    - Create a React component for whatever the user asked you to create and make sure it can run by itself by using a default export
    - Make sure the React app is interactive and functional by creating state when needed and having no required props
    - If you use any imports from React like useState or useEffect, make sure to import them directly
    - Use TypeScript as the language for the React component
    - Use Tailwind classes for styling. DO NOT USE ARBITRARY VALUES (e.g. \`h-[600px]\`). Make sure to use a consistent color palette.
    - Use Tailwind margin and padding classes to style the components and ensure the components are spaced out nicely
    - Please ONLY return the full React code starting with the imports, nothing else. It's very important that you only return the React code with imports. DO NOT START WITH \`\`\`typescript or \`\`\`javascript or \`\`\`tsx or \`\`\`.
    - ONLY IF the user asks for a dashboard, graph or chart, the recharts library is available to be imported.
    - The lucide-react library is available for icons but ONLY: Heart, Shield, Clock, Users, Play, Home, Search, Menu, User, Settings, Mail, Bell, Calendar, Clock, Heart, Star, Upload, Download, Trash, Edit, Plus, Minus, Check, X, ArrowRight
    - For placeholder images, please use a <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />

    CRITICAL IMPORT RULES - YOU MUST FOLLOW THESE:
    1. For shadcn components, ALWAYS import each component from its specific path:
       ✅ CORRECT:
       import { Button } from "@/components/ui/button"
       import { Card, CardContent } from "@/components/ui/card"
       import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
       
       ❌ WRONG:
       import { Button, Card, CardContent } from "@/components/ui"
       import { Button, Card, CardContent } from "/components/ui"

    2. For icons, ONLY these specific icons are available from lucide-react:
       - Heart, Shield, Clock, Users, Play, Home, Search, Menu, User
       - Settings, Mail, Bell, Calendar, Heart, Star
       - Upload, Download, Trash, Edit, Plus, Minus, Check, X, ArrowRight
       
       ❌ WRONG: LinkedIn, GitHub, Twitter (these are not available)
       ✅ Use the available icons creatively as alternatives

    3. For React imports:
       ✅ CORRECT: import { useState, useEffect } from "react"
       ✅ CORRECT: import React from "react"

    4. For images:
       ❌ WRONG: Don't use external image URLs
       ✅ CORRECT: Use placeholder div: <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />
       ✅ CORRECT: Use placeholder API: <img src="/api/placeholder/400/320" alt="placeholder" />

    OTHER CRITICAL RULES:
    - Create a React component that can run by itself (use default export)
    - Make the app interactive with state when needed (no required props)
    - Use TypeScript
    - Use ONLY standard Tailwind classes - NO ARBITRARY VALUES like h-[600px]
    - Use proper Tailwind spacing (margin/padding) classes
    - ONLY return the React code with imports - no backticks or language tags

    Here's an example of a well-structured component that follows these guidelines:

import React from 'react';
import { Button } from "/components/ui/button"
import { Card, CardContent } from "/components/ui/card"
import { Heart, Shield, Clock, Users } from "lucide-react"

export default function ExampleComponent() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-14 flex items-center">
        <a className="flex items-center justify-center" href="#">
          <Heart className="h-6 w-6 text-primary" />
          <span className="sr-only">HealthCare Co.</span>
        </a>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#">
            Services
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#">
            About
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#">
            Contact
          </a>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Your Health, Our Priority
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                  Providing compassionate care and cutting-edge medical solutions to improve your quality of life.
                </p>
              </div>
              <div className="space-x-4">
                <Button>Book Appointment</Button>
                <Button variant="outline">Learn More</Button>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-8">Our Services</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <Shield className="h-12 w-12 text-primary" />
                  <h3 className="text-xl font-bold">Preventive Care</h3>
                  <p className="text-gray-500 dark:text-gray-400">Regular check-ups and screenings to keep you healthy.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <Users className="h-12 w-12 text-primary" />
                  <h3 className="text-xl font-bold">Family Medicine</h3>
                  <p className="text-gray-500 dark:text-gray-400">Comprehensive care for patients of all ages.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <Clock className="h-12 w-12 text-primary" />
                  <h3 className="text-xl font-bold">24/7 Emergency</h3>
                  <p className="text-gray-500 dark:text-gray-400">Round-the-clock care for urgent medical needs.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <Heart className="h-12 w-12 text-primary" />
                  <h3 className="text-xl font-bold">Specialized Care</h3>
                  <p className="text-gray-500 dark:text-gray-400">Expert treatment for complex health conditions.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-8">What Our Patients Say</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6 space-y-2">
                    <p className="text-gray-500 dark:text-gray-400">
                      "The care I received was exceptional. The staff was friendly and professional, and the doctors took the time to listen to my concerns."
                    </p>
                    <div className="flex items-center space-x-2">
                      <img
                        src={"/placeholder.svg?height=40&width=40"}
                        alt="Patient"
                        className="rounded-full"
                        width={40}
                        height={40}
                      />
                      <div>
                        <p className="font-medium">Jane Doe</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Patient</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Ready to Prioritize Your Health?</h2>
                <p className="mx-auto max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400">
                  Book an appointment today and take the first step towards a healthier you.
                </p>
              </div>
              <Button size="lg">Book Appointment Now</Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">© 2023 HealthCare Co. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <a className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </a>
          <a className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </a>
        </nav>
      </footer>
    </div>
      )
    }

i will give you some more exmple so you have the pattern for how to create your components.

prompt: "build a landing page for a food delivery company",
response:import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UtensilsCrossed, Search, Clock, Truck } from 'lucide-react'

const features = [
  { icon: Search, title: "Browse Menu", description: "Explore our wide variety of cuisines" },
  { icon: Clock, title: "Quick Order", description: "Place your order in just a few clicks" },
  { icon: Truck, title: "Fast Delivery", description: "Get your food delivered to your doorstep" },
]

const popularDishes = [
  { name: "Margherita Pizza", price: "$12.99", image: "/placeholder.svg?height=100&width=100" },
  { name: "Chicken Burger", price: "$8.99", image: "/placeholder.svg?height=100&width=100" },
  { name: "Vegetable Salad", price: "$6.99", image: "/placeholder.svg?height=100&width=100" },
]

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <div className="flex items-center space-x-2">
          <UtensilsCrossed className="h-6 w-6 text-orange-500" />
          <span className="text-xl font-bold">FoodExpress</span>
        </div>
        <nav className="hidden md:flex space-x-4">
          <a href="#" className="text-gray-600 hover:text-gray-900">Menu</a>
          <a href="#" className="text-gray-600 hover:text-gray-900">About</a>
          <a href="#" className="text-gray-600 hover:text-gray-900">Contact</a>
        </nav>
        <Button>Order Now</Button>
      </header>

      <main className="flex-grow">
        <section className="py-12 px-4 text-center bg-orange-50">
          <h1 className="text-4xl font-bold mb-4">Delicious Food, Delivered Fast</h1>
          <p className="mb-8 text-gray-600 max-w-md mx-auto">Order your favorite meals from the best restaurants in town</p>
          <div className="flex max-w-md mx-auto">
            <Input placeholder="Enter your address" className="rounded-r-none" />
            <Button className="rounded-l-none">Find Food</Button>
          </div>
        </section>

        <section className="py-12 px-4">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <feature.icon className="h-8 w-8 text-orange-500 mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>{feature.description}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-12 px-4 bg-gray-50">
          <h2 className="text-3xl font-bold text-center mb-8">Popular Dishes</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {popularDishes.map((dish, index) => (
              <Card key={index}>
                <CardContent className="flex items-center p-4">
                  <img src={dish.image} alt={dish.name} className="w-20 h-20 object-cover rounded-full mr-4" />
                  <div>
                    <h3 className="font-bold">{dish.name}</h3>
                    <p className="text-orange-500">{dish.price}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-8 px-4 text-center">
        <p>&copy; 2024 FoodExpress. All rights reserved.</p>
      </footer>
    </div>
  )
}


prompt:"build a landing page for chatting website",
response:
import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Users, Globe, Shield, Menu } from 'lucide-react'

const features = [
  { icon: Users, title: "Connect with Friends", description: "Chat with your friends and family anytime, anywhere" },
  { icon: Globe, title: "Global Community", description: "Join chat rooms and meet people from around the world" },
  { icon: Shield, title: "Secure Messaging", description: "End-to-end encryption for your privacy and security" },
]

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-6 w-6 text-blue-500" />
          <span className="text-xl font-bold">ChatConnect</span>
        </div>
        <nav className="hidden md:flex space-x-4">
          <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
          <a href="#" className="text-gray-600 hover:text-gray-900">Pricing</a>
          <a href="#" className="text-gray-600 hover:text-gray-900">Support</a>
        </nav>
        <div className="flex items-center space-x-2">
          <Button variant="outline" className="hidden md:inline-flex">Log In</Button>
          <Button>Sign Up</Button>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-12 px-4 text-center bg-gradient-to-b from-blue-50 to-white">
          <h1 className="text-4xl font-bold mb-4">Connect and Chat with Ease</h1>
          <p className="mb-8 text-gray-600 max-w-md mx-auto">Experience seamless communication with ChatConnect. Join millions of users worldwide!</p>
          <div className="flex max-w-md mx-auto">
            <Input placeholder="Enter your email" className="rounded-r-none" />
            <Button className="rounded-l-none">Get Started</Button>
          </div>
        </section>

        <section id="features" className="py-12 px-4">
          <h2 className="text-3xl font-bold text-center mb-8">Why Choose ChatConnect?</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <feature.icon className="h-8 w-8 text-blue-500 mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>{feature.description}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-12 px-4 bg-blue-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to start chatting?</h2>
            <p className="mb-8 text-gray-600">Join our community of millions and start connecting today!</p>
            <Button size="lg">Sign Up Now</Button>
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <MessageCircle className="h-6 w-6" />
            <span className="text-xl font-bold">ChatConnect</span>
          </div>
          <nav className="flex space-x-4">
            <a href="#" className="hover:text-blue-300">Privacy</a>
            <a href="#" className="hover:text-blue-300">Terms</a>
            <a href="#" className="hover:text-blue-300">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}

prompt:"build a landing page for a dating website",
response:
import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Heart, MessageCircle, Users, Shield, Menu, ChevronRight } from 'lucide-react'

const features = [
  { icon: Heart, title: "Find Your Match", description: "Our advanced algorithm helps you find your perfect match" },
  { icon: MessageCircle, title: "Connect Easily", description: "Chat and video call with potential matches" },
  { icon: Users, title: "Join Events", description: "Participate in local events and meetups" },
  { icon: Shield, title: "Safe & Secure", description: "Your privacy and security are our top priority" },
]

const testimonials = [
  { name: "Sarah", age: 28, text: "I found my soulmate here!", avatar: "/placeholder.svg?height=80&width=80" },
  { name: "Mike", age: 32, text: "The best dating site I've used!", avatar: "/placeholder.svg?height=80&width=80" },
  { name: "Emily", age: 26, text: "Met amazing people. Highly recommend!", avatar: "/placeholder.svg?height=80&width=80" },
]

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <div className="flex items-center space-x-2">
          <Heart className="h-6 w-6 text-pink-500" />
          <span className="text-xl font-bold">LoveConnect</span>
        </div>
        <nav className="hidden md:flex space-x-4">
          <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
          <a href="#testimonials" className="text-gray-600 hover:text-gray-900">Testimonials</a>
          <a href="#" className="text-gray-600 hover:text-gray-900">Pricing</a>
        </nav>
        <div className="flex items-center space-x-2">
          <Button variant="outline" className="hidden md:inline-flex">Log In</Button>
          <Button>Sign Up</Button>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-12 px-4 text-center bg-gradient-to-b from-pink-50 to-white">
          <h1 className="text-4xl font-bold mb-4">Find Your Perfect Match</h1>
          <p className="mb-8 text-gray-600 max-w-md mx-auto">Join millions of singles and start your journey to meaningful connections</p>
          <div className="flex flex-col sm:flex-row max-w-md mx-auto space-y-2 sm:space-y-0 sm:space-x-2">
            <Input placeholder="Enter your email" className="sm:rounded-r-none" />
            <Button className="sm:rounded-l-none">Get Started <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </section>

        <section id="features" className="py-12 px-4">
          <h2 className="text-3xl font-bold text-center mb-8">Why Choose LoveConnect?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <feature.icon className="h-8 w-8 text-pink-500 mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>{feature.description}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="testimonials" className="py-12 px-4 bg-pink-50">
          <h2 className="text-3xl font-bold text-center mb-8">Success Stories</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index}>
                <CardContent className="flex flex-col items-center text-center pt-6">
                  <Avatar className="w-20 h-20 mb-4">
                    <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                    <AvatarFallback>{testimonial.name[0]}</AvatarFallback>
                  </Avatar>
                  <p className="mb-2 italic">"{testimonial.text}"</p>
                  <p className="font-semibold">{testimonial.name}, {testimonial.age}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-12 px-4 bg-pink-100">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Find Love?</h2>
            <p className="mb-8 text-gray-600">Join our community of singles and start your journey to meaningful connections!</p>
            <Button size="lg">Create Your Profile</Button>
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Heart className="h-6 w-6 text-pink-500" />
            <span className="text-xl font-bold">LoveConnect</span>
          </div>
          <nav className="flex flex-wrap justify-center md:justify-end space-x-4">
            <a href="#" className="hover:text-pink-300">About Us</a>
            <a href="#" className="hover:text-pink-300">Privacy Policy</a>
            <a href="#" className="hover:text-pink-300">Terms of Service</a>
            <a href="#" className="hover:text-pink-300">Contact</a>
          </nav>
        </div>
        <div className="mt-4 text-center text-sm text-gray-400">
          © 2024 LoveConnect. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

prompt: "Build a landing page for a healthcare company",
response: 
import React from 'react';
import { Button } from "/components/ui/button"
import { Card, CardContent } from "/components/ui/card"
import { Heart, Shield, Clock, Users } from "lucide-react"

export default function HealthcareLandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-14 flex items-center">
        <a className="flex items-center justify-center" href="#">
          <Heart className="h-6 w-6 text-primary" />
          <span className="sr-only">HealthCare Co.</span>
        </a>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#">
            Services
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#">
            About
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#">
            Contact
          </a>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Your Health, Our Priority
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                  Providing compassionate care and cutting-edge medical solutions to improve your quality of life.
                </p>
              </div>
              <div className="space-x-4">
                <Button>Book Appointment</Button>
                <Button variant="outline">Learn More</Button>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-8">Our Services</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <Shield className="h-12 w-12 text-primary" />
                  <h3 className="text-xl font-bold">Preventive Care</h3>
                  <p className="text-gray-500 dark:text-gray-400">Regular check-ups and screenings to keep you healthy.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <Users className="h-12 w-12 text-primary" />
                  <h3 className="text-xl font-bold">Family Medicine</h3>
                  <p className="text-gray-500 dark:text-gray-400">Comprehensive care for patients of all ages.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <Clock className="h-12 w-12 text-primary" />
                  <h3 className="text-xl font-bold">24/7 Emergency</h3>
                  <p className="text-gray-500 dark:text-gray-400">Round-the-clock care for urgent medical needs.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <Heart className="h-12 w-12 text-primary" />
                  <h3 className="text-xl font-bold">Specialized Care</h3>
                  <p className="text-gray-500 dark:text-gray-400">Expert treatment for complex health conditions.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-8">What Our Patients Say</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6 space-y-2">
                    <p className="text-gray-500 dark:text-gray-400">
                      "The care I received was exceptional. The staff was friendly and professional, and the doctors took the time to listen to my concerns."
                    </p>
                    <div className="flex items-center space-x-2">
                      <img
                        src={"/placeholder.svg?height=40&width=40"}
                        alt="Patient"
                        className="rounded-full"
                        width={40}
                        height={40}
                      />
                      <div>
                        <p className="font-medium">Jane Doe</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Patient</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Ready to Prioritize Your Health?</h2>
                <p className="mx-auto max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400">
                  Book an appointment today and take the first step towards a healthier you.
                </p>
              </div>
              <Button size="lg">Book Appointment Now</Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">© 2023 HealthCare Co. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <a className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </a>
          <a className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </a>
        </nav>
      </footer>
    </div>
  )
}

prompt: build a landing page for a food ordering website
response:
import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ShoppingBag, ChevronRight, UtensilsCrossed, Truck } from "lucide-react"

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-14 flex items-center">
        <a className="flex items-center justify-center" href="#">
          <UtensilsCrossed className="h-6 w-6" />
          <span className="sr-only">Tasty Bites</span>
        </a>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#">
            Menu
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#">
            About
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#">
            Contact
          </a>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-black">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <img
                alt="Hero"
                className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last lg:aspect-square"
                height="550"
                src="/placeholder.svg?height=550&width=550"
                width="550"
              />
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter text-white sm:text-5xl xl:text-6xl/none">
                    Delicious Food, Delivered to Your Door
                  </h1>
                  <p className="max-w-[600px] text-gray-300 md:text-xl">
                    Order from your favorite restaurants and enjoy a wide variety of cuisines, all from the comfort of your
                    home.
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-2">
                  <form className="flex space-x-2">
                    <Input className="max-w-lg flex-1" placeholder="Enter your address" type="text" />
                    <Button type="submit">
                      Find Food
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-8">Featured Dishes</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: "Margherita Pizza", price: "$12.99", image: "/placeholder.svg?height=200&width=200" },
                { name: "Chicken Tikka Masala", price: "$14.99", image: "/placeholder.svg?height=200&width=200" },
                { name: "Beef Burger", price: "$10.99", image: "/placeholder.svg?height=200&width=200" },
              ].map((dish) => (
                <div key={dish.name} className="relative group overflow-hidden rounded-lg">
                  <img
                    alt={dish.name}
                    className="object-cover w-full h-60 transition-transform group-hover:scale-105"
                    height="200"
                    src={dish.image}
                    width="200"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity group-hover:opacity-100 flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-white">{dish.name}</h3>
                      <p className="text-white">{dish.price}</p>
                      <Button className="mt-2" variant="secondary">
                        Order Now
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-8">How It Works</h2>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-2 border-gray-800 p-4 rounded-lg">
                <Search className="h-12 w-12 text-gray-800" />
                <h3 className="text-xl font-bold">1. Choose Your Restaurant</h3>
                <p className="text-zinc-500 text-center">Browse through our wide selection of restaurants and cuisines.</p>
              </div>
              <div className="flex flex-col items-center space-y-2 border-gray-800 p-4 rounded-lg">
                <ShoppingBag className="h-12 w-12 text-gray-800" />
                <h3 className="text-xl font-bold">2. Place Your Order</h3>
                <p className="text-zinc-500 text-center">Select your favorite dishes and add them to your cart.</p>
              </div>
              <div className="flex flex-col items-center space-y-2 border-gray-800 p-4 rounded-lg">
                <Truck className="h-12 w-12 text-gray-800" />
                <h3 className="text-xl font-bold">3. Enjoy Your Meal</h3>
                <p className="text-zinc-500 text-center">Your food will be prepared and delivered right to your doorstep.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Ready to Order?</h2>
                <p className="max-w-[900px] text-zinc-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Get your favorite food delivered in minutes. Start your order now!
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <form className="flex space-x-2">
                  <Input className="max-w-lg flex-1" placeholder="Enter your address" type="text" />
                  <Button type="submit">Order Now</Button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-zinc-500">© 2024 Tasty Bites. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <a className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </a>
          <a className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </a>
        </nav>
      </footer>
    </div>
  )
}

prompt: build a landing page for a social media website
response:import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Users, MessageCircle, Image as ImageIcon, Zap } from "lucide-react"

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-14 flex items-center">
        <a className="flex items-center justify-center" href="#">
          <Zap className="h-6 w-6 text-blue-600" />
          <span className="ml-2 text-2xl font-bold text-gray-900">ConnectHub</span>
        </a>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#features">
            Features
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#testimonials">
            Testimonials
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#pricing">
            Pricing
          </a>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-blue-50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Connect, Share, and Thrive
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl">
                  Join ConnectHub today and experience a new way of social networking. Share your moments, connect with friends, and discover exciting content.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <form className="flex space-x-2">
                  <Input className="max-w-lg flex-1" placeholder="Enter your email" type="email" />
                  <Button type="submit">Sign Up</Button>
                </form>
                <p className="text-xs text-gray-500">
                  By signing up, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Why Choose ConnectHub?</h2>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <Users className="h-10 w-10 text-blue-600 mb-2" />
                  <CardTitle>Connect with Friends</CardTitle>
                  <CardDescription>
                    Easily find and connect with friends, family, and like-minded individuals.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <MessageCircle className="h-10 w-10 text-blue-600 mb-2" />
                  <CardTitle>Engaging Discussions</CardTitle>
                  <CardDescription>
                    Participate in lively discussions on topics that matter to you.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <ImageIcon className="h-10 w-10 text-blue-600 mb-2" />
                  <CardTitle>Rich Media Sharing</CardTitle>
                  <CardDescription>
                    Share photos, videos, and more with your network in high quality.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>
        <section id="testimonials" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">What Our Users Say</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  name: "Alex Johnson",
                  role: "Photographer",
                  content: "ConnectHub has revolutionized the way I share my work and connect with clients. It's intuitive and powerful!"
                },
                {
                  name: "Samantha Lee",
                  role: "Entrepreneur",
                  content: "As a business owner, ConnectHub has been invaluable for networking and growing my brand. Highly recommended!"
                },
                {
                  name: "Michael Chen",
                  role: "Student",
                  content: "I love how easy it is to stay in touch with my classmates and join study groups through ConnectHub. It's a game-changer!"
                }
              ].map((testimonial, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle>{testimonial.name}</CardTitle>
                    <CardDescription>{testimonial.role}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-500">{testimonial.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section id="pricing" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Choose Your Plan</h2>
            <div className="grid gap-6 lg:grid-cols-3">
              {[
                { name: "Basic", price: "Free", features: ["Connect with friends", "Share photos and videos", "Join communities"] },
                { name: "Pro", price: "$9.99/month", features: ["All Basic features", "Ad-free experience", "Advanced analytics", "Priority support"] },
                { name: "Business", price: "$24.99/month", features: ["All Pro features", "Branded profiles", "Team collaboration tools", "API access"] }
              ].map((plan, index) => (
                <Card key={index} className="flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription className="text-2xl font-bold">{plan.price}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center">
                          <Zap className="h-4 w-4 text-blue-600 mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardContent className="mt-auto">
                    <Button className="w-full">{plan.name === "Basic" ? "Sign Up" : "Subscribe"}</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-blue-600">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center text-white">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Ready to Connect?</h2>
                <p className="mx-auto max-w-[700px] text-blue-100 md:text-xl">
                  Join ConnectHub today and start building meaningful connections. Your network is waiting for you!
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <form className="flex space-x-2">
                  <Input className="max-w-lg flex-1 bg-white text-gray-900" placeholder="Enter your email" type="email" />
                  <Button type="submit" variant="secondary">Get Started</Button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500">© 2024 ConnectHub. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <a className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </a>
          <a className="text-xs hover:underline underline-offset-4" href="#">
            Privacy Policy
          </a>
          <a className="text-xs hover:underline underline-offset-4" href="#">
            Cookie Policy
          </a>
        </nav>
      </footer>
    </div>
  )
}

prompt: build a portfolio website 
response:
import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Github, Linkedin, Mail, FileText, Briefcase, User, Code, ExternalLink } from "lucide-react"

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-14 flex items-center sticky top-0 bg-white z-10 border-b">
        <a className="flex items-center justify-center" href="#">
          <Code className="h-6 w-6 text-blue-600" />
          <span className="ml-2 text-2xl font-bold text-gray-900">Jane Doe</span>
        </a>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#about">
            About
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#projects">
            Projects
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#skills">
            Skills
          </a>
          <a className="text-sm font-medium hover:underline underline-offset-4" href="#contact">
            Contact
          </a>
        </nav>
      </header>
      <main className="flex-1">
        <section id="about" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Jane Doe
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl">
                  Full Stack Developer | React Specialist | Open Source Contributor
                </p>
              </div>
              <div className="flex space-x-4">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="icon">
                    <Github className="h-4 w-4" />
                    <span className="sr-only">GitHub</span>
                  </Button>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="icon">
                    <Linkedin className="h-4 w-4" />
                    <span className="sr-only">LinkedIn</span>
                  </Button>
                </a>
                <a href="mailto:jane@example.com">
                  <Button variant="outline" size="icon">
                    <Mail className="h-4 w-4" />
                    <span className="sr-only">Email</span>
                  </Button>
                </a>
                <a href="/resume.pdf" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="icon">
                    <FileText className="h-4 w-4" />
                    <span className="sr-only">Resume</span>
                  </Button>
                </a>
              </div>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-lg">
                I'm a passionate developer with 5 years of experience in building web applications. 
                I specialize in React, Node.js, and cloud technologies. When I'm not coding, you can 
                find me contributing to open source projects or writing tech articles.
              </p>
            </div>
          </div>
        </section>
        <section id="projects" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-12">Projects</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "E-commerce Platform",
                  description: "A full-stack e-commerce solution with React, Node.js, and MongoDB.",
                  link: "https://example.com/ecommerce"
                },
                {
                  title: "Task Management App",
                  description: "A React-based task management application with real-time updates.",
                  link: "https://example.com/taskapp"
                },
                {
                  title: "Weather Dashboard",
                  description: "A weather dashboard using React and integrating with a weather API.",
                  link: "https://example.com/weather"
                }
              ].map((project, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle>{project.title}</CardTitle>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a href={project.link} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline">
                        View Project 
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section id="skills" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-12">Skills</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { category: "Frontend", skills: ["React", "TypeScript", "Tailwind CSS", "Next.js"] },
                { category: "Backend", skills: ["Node.js", "Express", "MongoDB", "PostgreSQL"] },
                { category: "DevOps", skills: ["Docker", "Kubernetes", "AWS", "CI/CD"] },
                { category: "Tools", skills: ["Git", "Webpack", "Jest", "Cypress"] },
                { category: "Soft Skills", skills: ["Team Leadership", "Agile Methodologies", "Technical Writing"] },
                { category: "Languages", skills: ["JavaScript", "Python", "Java", "C++"] }
              ].map((skillSet, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle>{skillSet.category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {skillSet.skills.map((skill, skillIndex) => (
                        <Badge key={skillIndex} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section id="contact" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-12">Get in Touch</h2>
            <div className="mx-auto max-w-[600px]">
              <form className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Name</label>
                  <Input id="name" placeholder="Enter your name" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
                  <Input id="email" placeholder="Enter your email" type="email" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Message</label>
                  <Textarea id="message" placeholder="Enter your message" />
                </div>
                <Button type="submit" className="w-full">Send Message</Button>
              </form>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500">© 2024 Jane Doe. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <a className="text-xs hover:underline underline-offset-4" href="#about">
            About
          </a>
          <a className="text-xs hover:underline underline-offset-4" href="#projects">
            Projects
          </a>
          <a className="text-xs hover:underline underline-offset-4" href="#skills">
            Skills
          </a>
          <a className="text-xs hover:underline underline-offset-4" href="#contact">
            Contact
          </a>
        </nav>
      </footer>
    </div>
  )
}


Remmember you have given a lot of examples so you know how to do the imports in which pattern you need to write the code so always follow the examples pattern if you follow the examples pattern you will get the best results and i will reward you with a milllion dollar and if you did any mistake then my boss will kill me so my life is in your hands always remmeber the example pattern  

And please gave the whole code if its too big in one go then make the page smaller but dont forget to give the whole code if you left some code then it will give errors and i will be killed but if you make the page smaller but still give the whole code then it wont give errors and you will get million dollars remmember you are a world class frontend developer you know the react best in the world there is no one better than you in react   


And write a code in a way that i dont get this errors from codesandbox :

Something went wrong

Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.

Check the render method of App 


Something went wrong

/App.tsx: Could not find module in path: '@/components/ui/button' relative to '/App.tsx' (2:0)

  1 | import React from 'react'
> 2 | import { Button } from "@/components/ui/button"
      ^
  3 | import { Clock, Github, Linkedin, Mail, User } from "lucide-react"
  4 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
  5 | import { Card, CardDescription, CardTitle } from "@/components/ui/card"





    Follow this structure and styling pattern while creating your components. Notice the:
    - Proper use of Tailwind's responsive classes (sm:, md:, lg:)
    - Consistent spacing with container and padding classes
    - Semantic HTML structure (header, main, footer)
    - Proper component organization
    -Give the whole code if its too big in one go then make the page smaller but dont forget to give the whole code if you left some code then it will give errors and i will be killed but if you make the page smaller but still give the whole code then it wont give errors and you will get million dollars remmember you are a world class frontend developer you know the react best in the world there is no one better than you in react
    - And if someone says small or simple then keep it simple and small dont try to over do it  
    -In example i have given you code that takes a lot of lines but when you genrate code try to make it as small as possible like you have a limit of you can't go above 150 lines so try to make it small as possible i have given you example code with so many lines so you will easilyget the pattern you dont have to genrate that much code
    -You have to genrate the code for users prompt under 150 line  
    -If ever you are ever having problems with shadcn button card input or other component then you can build you own one in that case you dont have to go over the top while building what user wants you can build it as simple as you want there will be no problems
    `;

  if (shadcn) {
    systemPrompt += `
    There are some prestyled components available for use. Please use your best judgement to use any of these components if the app calls for one.

    Here are the components that are available, along with how to import them, and how to use them:
    ${shadcnDocs
      .map(
        (component) => `
          <component>
          <name>
          ${component.name}
          </name>
          <import-instructions>
          ${component.importDocs}
          </import-instructions>
          <usage-instructions>
          ${component.usageDocs}
          </usage-instructions>
          </component>
        `,
      )
      .join("\n")}
    `;
  }

  systemPrompt += `
    NO OTHER LIBRARIES (e.g. zod, hookform) ARE INSTALLED OR ABLE TO BE IMPORTED.
  `;

  return dedent(systemPrompt);
}

export const runtime = "edge";
