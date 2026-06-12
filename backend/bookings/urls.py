from django.urls import path

from .views import (
    AutoApprovalRuleDetailView,
    AutoApprovalRuleListView,
    BookingApproveView,
    BookingAvailabilityView,
    BookingCancelView,
    BookingCheckInView,
    BookingDetailView,
    BookingExportView,
    BookingListCreateView,
    BookingRejectView,
    TermDateDetailView,
    TermDateListView,
    WaitlistDetailView,
    WaitlistView,
)

urlpatterns = [
    # Bookings
    path('', BookingListCreateView.as_view(), name='booking-list-create'),
    path('availability/', BookingAvailabilityView.as_view(), name='booking-availability'),
    path('export/', BookingExportView.as_view(), name='booking-export'),
    path('waitlist/', WaitlistView.as_view(), name='booking-waitlist'),
    path('waitlist/<int:pk>/', WaitlistDetailView.as_view(), name='booking-waitlist-detail'),
    path('<int:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('<int:pk>/approve/', BookingApproveView.as_view(), name='booking-approve'),
    path('<int:pk>/reject/', BookingRejectView.as_view(), name='booking-reject'),
    path('<int:pk>/cancel/', BookingCancelView.as_view(), name='booking-cancel'),
    path('<int:pk>/checkin/', BookingCheckInView.as_view(), name='booking-checkin'),
    # Admin settings
    path('approval-rules/', AutoApprovalRuleListView.as_view(), name='approval-rule-list'),
    path('approval-rules/<int:pk>/', AutoApprovalRuleDetailView.as_view(), name='approval-rule-detail'),
    path('term-dates/', TermDateListView.as_view(), name='term-date-list'),
    path('term-dates/<int:pk>/', TermDateDetailView.as_view(), name='term-date-detail'),
]
