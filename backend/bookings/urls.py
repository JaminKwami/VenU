from django.urls import path

from .views import (
    BookingListCreateView,
    BookingDetailView,
    BookingApproveView,
    BookingRejectView,
    BookingCancelView,
    BookingAvailabilityView,
    BookingExportView,
    WaitlistView,
    WaitlistDetailView,
)

urlpatterns = [
    path('', BookingListCreateView.as_view(), name='booking-list-create'),
    path('availability/', BookingAvailabilityView.as_view(), name='booking-availability'),
    path('export/', BookingExportView.as_view(), name='booking-export'),
    path('waitlist/', WaitlistView.as_view(), name='booking-waitlist'),
    path('waitlist/<int:pk>/', WaitlistDetailView.as_view(), name='booking-waitlist-detail'),
    path('<int:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('<int:pk>/approve/', BookingApproveView.as_view(), name='booking-approve'),
    path('<int:pk>/reject/', BookingRejectView.as_view(), name='booking-reject'),
    path('<int:pk>/cancel/', BookingCancelView.as_view(), name='booking-cancel'),
]
