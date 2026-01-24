/**
 * Terms of Service Page
 * Basic terms and conditions for using Quoth
 */

import { Navbar, Footer, PageHeader } from "@/components/quoth";

export default function TermsPage() {
  return (
    <div className="min-h-screen animate-page-fade-in">
      <Navbar />

      <PageHeader
        badge="Legal"
        title="Terms of Service"
        subtitle="Please read these terms carefully before using Quoth."
      />

      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="glass-panel p-8 rounded-2xl space-y-8">
            {/* Last Updated */}
            <p className="text-sm text-gray-500">
              Last updated: January 2025
            </p>

            {/* Introduction */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-serif" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                1. Introduction
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Welcome to Quoth. By accessing or using our service, you agree to be bound by these Terms of Service.
                If you disagree with any part of the terms, you may not access the service.
              </p>
            </div>

            {/* Service Description */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-serif" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                2. Service Description
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Quoth is a Model Context Protocol (MCP) server that provides AI-assisted documentation management
                and codebase auditing services. The service includes semantic search, documentation proposals,
                and integration with AI agents.
              </p>
            </div>

            {/* User Responsibilities */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-serif" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                3. User Responsibilities
              </h2>
              <p className="text-gray-400 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and API keys.
                You agree not to share your access tokens or use the service for any unlawful purpose.
              </p>
            </div>

            {/* Data Usage */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-serif" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                4. Data Usage
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Documentation and code snippets you upload to Quoth are stored securely and used solely to provide
                the service. We do not share your content with third parties except as necessary to operate the service.
              </p>
            </div>

            {/* Intellectual Property */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-serif" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                5. Intellectual Property
              </h2>
              <p className="text-gray-400 leading-relaxed">
                You retain all rights to your documentation and code. Quoth claims no ownership over your content.
                The Quoth service, including its design and branding, remains our intellectual property.
              </p>
            </div>

            {/* Limitation of Liability */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-serif" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                6. Limitation of Liability
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Quoth is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages
                arising from your use of the service, including but not limited to data loss or service interruptions.
              </p>
            </div>

            {/* Changes to Terms */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-serif" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                7. Changes to Terms
              </h2>
              <p className="text-gray-400 leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of significant changes
                via email or through the service. Continued use after changes constitutes acceptance of the new terms.
              </p>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-serif" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                8. Contact
              </h2>
              <p className="text-gray-400 leading-relaxed">
                For questions about these Terms of Service, please contact us through our GitHub repository
                or the support channels available in the application.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
